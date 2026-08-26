import { Injectable, computed, signal } from '@angular/core';
import {
  HALFTONE_CONFIG,
  HalftoneInk,
  HalftoneMode,
  PROCESS_COLORS,
} from '../constants/halftone.constants';
import { buildDensity, buildScreen } from '../utils/screen.util';
import { HalftoneFiltersService } from './filters.service';
import { ImageSlot } from '@shared/utils/image-slot';
import { IMAGE_DECODE_ERROR, decodeImage } from '@shared/utils/decode-image';

interface BuiltScreen {
  ink: HalftoneInk;
  mask: HTMLCanvasElement;
}

/**
 * Two-stage pipeline, mirroring how a press actually works:
 *
 *   1. HEAVY - each ink is screened once into an alpha mask (the plate).
 *   2. CHEAP - `paint()` lays down paper and pulls each mask through in its
 *              ink colour (the impression).
 *
 * Because the masks carry no colour, changing ink or paper only re-runs stage
 * two. That is the whole reason the split exists: screening a 2048px image at
 * a small cell is hundreds of thousands of path segments, and dragging a
 * colour picker must not pay for it.
 */
@Injectable({
  providedIn: 'root',
})
export class HalftoneCanvasService {
  private _hasImage = signal(false);
  private _isProcessing = signal(false);
  private _isExporting = signal(false);
  private _imageSize = signal<{ width: number; height: number } | null>(null);
  private _sourceSize = signal<{ width: number; height: number } | null>(null);
  // Bumped whenever the plates are rebuilt, so views know to repaint.
  private _layerVersion = signal(0);
  private _lastRenderMs = signal<number | null>(null);
  private _dotCount = signal<number | null>(null);
  // Settings the plates on screen were actually built from. Compared against
  // the live key to tell whether the preview has fallen behind the controls.
  private _appliedKey = signal<string | null>(null);
  private _loadError = signal<string | null>(null);

  readonly hasImage = this._hasImage.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();
  readonly imageSize = this._imageSize.asReadonly();
  readonly sourceSize = this._sourceSize.asReadonly();
  readonly layerVersion = this._layerVersion.asReadonly();
  readonly lastRenderMs = this._lastRenderMs.asReadonly();
  readonly dotCount = this._dotCount.asReadonly();
  /** Set when the chosen file could not be decoded. */
  readonly loadError = this._loadError.asReadonly();

  /**
   * True when a screening input has changed since the plates were built, so
   * what is on screen no longer matches the controls. Only reachable with
   * live preview off, which is the whole point of showing it.
   */
  readonly hasPendingChanges = computed(
    () =>
      this._hasImage() &&
      this._appliedKey() !== null &&
      this._appliedKey() !== this.filtersService.heavyKey(),
  );

  /** True when MAX_DIMENSION actually reduced the image. */
  readonly isDownscaled = computed(() => {
    const src = this._sourceSize();
    const work = this._imageSize();
    return !!src && !!work && src.width > work.width;
  });

  /** Resolution the download will be produced at. */
  readonly exportSize = computed(() => {
    const src = this._sourceSize();
    if (!src) return null;
    return fitWithin(
      src.width,
      src.height,
      HALFTONE_CONFIG.EXPORT.MAX_DIMENSION,
    );
  });

  /** Survives navigation, so the sidebar preview persists across routes. */
  readonly imageSlot = new ImageSlot();

  private sourceImage: HTMLImageElement | null = null;
  private sourceCanvas: HTMLCanvasElement | null = null;
  private workingData: ImageData | null = null;
  private screens: BuiltScreen[] = [];
  // The mode the current plates belong to. The preview composites with this
  // rather than the live setting, so a stale preview stays internally
  // consistent instead of blending mono plates as if they were process inks.
  private builtMode: HalftoneMode = 'mono';
  private tintCanvas: HTMLCanvasElement | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  private rebuildGeneration = 0;

  constructor(private filtersService: HalftoneFiltersService) {}

  /**
   * Entry point from the upload control: remembers the file, then decodes it.
   *
   * A file that cannot be decoded clears the slot rather than leaving it half
   * loaded. The preview would try the same bytes and fail too, so the panel
   * would show a broken thumbnail under a filename implying success.
   */
  async loadFile(file: File): Promise<void> {
    this._loadError.set(null);
    const url = this.imageSlot.set(file);
    try {
      this.setImage(await decodeImage(url));
    } catch {
      this.clearImage();
      this._loadError.set(IMAGE_DECODE_ERROR);
    }
  }

  setImage(img: HTMLImageElement): void {
    const size = fitWithin(
      img.width,
      img.height,
      HALFTONE_CONFIG.CANVAS.MAX_DIMENSION,
    );

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0, size.width, size.height);

    this.sourceImage = img;
    this.sourceCanvas = canvas;
    // Read once. Every channel map is derived from this same buffer.
    this.workingData = ctx.getImageData(0, 0, size.width, size.height);
    this.screens = [];
    this.tintCanvas = null;

    this._hasImage.set(true);
    this._sourceSize.set({ width: img.width, height: img.height });
    this._imageSize.set(size);
    this.rebuild();
  }

  clearImage(): void {
    this.imageSlot.clear();
    this.sourceImage = null;
    this.sourceCanvas = null;
    this.workingData = null;
    this.screens = [];
    this.tintCanvas = null;
    this._hasImage.set(false);
    this._imageSize.set(null);
    this._sourceSize.set(null);
    this._lastRenderMs.set(null);
    this._dotCount.set(null);
    this._appliedKey.set(null);
    this._layerVersion.update((v) => v + 1);
  }

  /** Debounced entry point, coalescing slider drags into a single pass. */
  scheduleRebuild(): void {
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(
      () => this.rebuild(),
      HALFTONE_CONFIG.REBUILD_DEBOUNCE_MS,
    );
  }

  rebuild(): void {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
    const image = this.workingData;
    if (!image) return;

    const generation = ++this.rebuildGeneration;
    this._isProcessing.set(true);

    // Yield once so the processing flag paints before the blocking pass starts.
    setTimeout(() => {
      if (generation !== this.rebuildGeneration) return;
      try {
        const started = performance.now();
        this.screens = this.buildScreens(
          image,
          image.width,
          image.height,
          null,
        );
        this.builtMode = this.filtersService.filters().mode;
        this._appliedKey.set(this.filtersService.heavyKey());
        this._lastRenderMs.set(Math.round(performance.now() - started));
        this._dotCount.set(this.estimateDots(image.width, image.height));
        this._layerVersion.update((v) => v + 1);
      } catch (error) {
        console.error('Error building halftone screens:', error);
      } finally {
        if (generation === this.rebuildGeneration) {
          this._isProcessing.set(false);
        }
      }
    }, 0);
  }

  /**
   * Screens every ink in the current plan.
   *
   * Density maps are built and discarded one channel at a time. Holding all
   * four at export resolution would be a hundred megabytes of typed array for
   * no reason, since each is consumed immediately.
   */
  private buildScreens(
    image: ImageData,
    width: number,
    height: number,
    cellOverride: number | null,
  ): BuiltScreen[] {
    const f = this.filtersService.filters();
    const cell = cellOverride ?? f.cell;

    return this.filtersService.screenPlan().map(({ ink, angle }) => {
      const channel = ink === 'ink' ? 'mono' : ink;
      const density = buildDensity(image, channel);
      const mask = buildScreen(density, width, height, {
        cell,
        angle,
        shape: f.shape,
        response: f.response,
        dotScale: f.dotScale / 100,
        negative: f.negative,
      });
      return { ink, mask };
    });
  }

  /**
   * Lays paper down, then pulls each plate through in its ink colour.
   *
   * Mono composites normally so a light ink on dark paper still reads. CMYK
   * composites with multiply, because overlapping process inks subtract light:
   * source-over would let magenta simply cover cyan instead of making blue.
   */
  paint(target: HTMLCanvasElement): void {
    const size = this._imageSize();
    if (!size) return;
    this.paintInto(
      target,
      this.screens,
      size.width,
      size.height,
      this.builtMode,
    );
  }

  private paintInto(
    target: HTMLCanvasElement,
    screens: BuiltScreen[],
    width: number,
    height: number,
    mode: HalftoneMode,
  ): void {
    if (target.width !== width) target.width = width;
    if (target.height !== height) target.height = height;

    const f = this.filtersService.filters();
    const ctx = target.getContext('2d')!;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = f.paperColor;
    ctx.fillRect(0, 0, width, height);

    if (!screens.length) return;

    const tint = this.getTintCanvas(width, height);
    const tintCtx = tint.getContext('2d')!;
    const blend = mode === 'cmyk' ? 'multiply' : 'source-over';

    for (const screen of screens) {
      const color =
        screen.ink === 'ink' ? f.inkColor : PROCESS_COLORS[screen.ink];

      tintCtx.globalCompositeOperation = 'source-over';
      tintCtx.clearRect(0, 0, width, height);
      tintCtx.fillStyle = color;
      tintCtx.fillRect(0, 0, width, height);
      // The mask is alpha only, so this stamps the ink into the dot shapes.
      tintCtx.globalCompositeOperation = 'destination-in';
      tintCtx.drawImage(screen.mask, 0, 0);

      ctx.globalCompositeOperation = blend;
      ctx.drawImage(tint, 0, 0);
    }

    ctx.globalCompositeOperation = 'source-over';
  }

  /** One scratch canvas, reused across plates and across repaints. */
  private getTintCanvas(width: number, height: number): HTMLCanvasElement {
    let canvas = this.tintCanvas;
    if (!canvas) {
      canvas = document.createElement('canvas');
      this.tintCanvas = canvas;
    }
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    return canvas;
  }

  /** Roughly how many dots the current settings put on the page, all plates. */
  private estimateDots(width: number, height: number): number {
    const cell = this.filtersService.filters().cell;
    const perPlate = Math.round((width * height) / (cell * cell));
    return perPlate * this.filtersService.screenPlan().length;
  }

  /**
   * Re-screens against the original file rather than upscaling the preview.
   *
   * The cell is scaled by the same factor as the image, so the print keeps the
   * dot density it was designed with. Skipping that would export the preview's
   * dot COUNT at a larger size, which is a coarser image, not a bigger one.
   */
  async downloadImage(): Promise<void> {
    const img = this.sourceImage;
    const working = this._imageSize();
    if (!img || !working || this._isExporting()) return;

    this._isExporting.set(true);
    // Yield so the button state paints before the blocking pass starts.
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      const size = fitWithin(
        img.width,
        img.height,
        HALFTONE_CONFIG.EXPORT.MAX_DIMENSION,
      );

      const full = document.createElement('canvas');
      full.width = size.width;
      full.height = size.height;
      const fullCtx = full.getContext('2d', { willReadFrequently: true })!;
      fullCtx.drawImage(img, 0, 0, size.width, size.height);
      const data = fullCtx.getImageData(0, 0, size.width, size.height);

      const cell = this.filtersService.cellForWidth(working.width, size.width);
      const screens = this.buildScreens(data, size.width, size.height, cell);

      const out = document.createElement('canvas');
      const mode = this.filtersService.filters().mode;
      this.paintInto(out, screens, size.width, size.height, mode);

      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, 'image/png'),
      );
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download =
        'halftone-' + new Date().toISOString().slice(0, 10) + '.png';
      link.href = url;
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting halftone:', error);
    } finally {
      this._isExporting.set(false);
    }
  }
}

/** Scales `width` by `height` down so neither side exceeds `max`. */
function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
