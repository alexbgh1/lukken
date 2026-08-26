import { Injectable, computed, signal } from '@angular/core';
import {
  GLASS_CONFIG,
  GlassPolygon,
  GlassRect,
} from '../constants/glass.constants';
import { generateTexture, textureFromImage } from '../utils/texture.util';
import { GlassFiltersService } from './filters.service';
import { ImageSlot } from '@shared/utils/image-slot';
import { IMAGE_DECODE_ERROR, decodeImage } from '@shared/utils/decode-image';

/**
 * Two-stage pipeline, mirroring the Photoshop layer + mask model:
 *
 *   1. HEAVY  - the whole image is displaced once into `glassLayer`.
 *   2. CHEAP  - `composite()` paints the original, then reveals `glassLayer`
 *               through the mask.
 *
 * Because the layer is always drawn at (0,0), the distortion stays welded to
 * the photo: moving or resizing the mask reveals more of the SAME result
 * instead of re-flowing the texture. It also means mask dragging never pays
 * the displacement cost.
 */
@Injectable({
  providedIn: 'root',
})
export class GlassCanvasService {
  private _hasImage = signal(false);
  private _isProcessing = signal(false);
  private _imageSize = signal<{ width: number; height: number } | null>(null);
  // Dimensions of the file as uploaded, before the working-resolution cap.
  private _sourceSize = signal<{ width: number; height: number } | null>(null);
  // Bumped whenever the glass layer is rebuilt, so views know to repaint.
  private _layerVersion = signal(0);
  private _lastRenderMs = signal<number | null>(null);
  private _isExporting = signal(false);
  private _loadError = signal<string | null>(null);

  readonly hasImage = this._hasImage.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly imageSize = this._imageSize.asReadonly();
  readonly sourceSize = this._sourceSize.asReadonly();
  /** True when MAX_DIMENSION actually reduced the image. */
  readonly isDownscaled = computed(() => {
    const src = this._sourceSize();
    const work = this._imageSize();
    return !!src && !!work && src.width > work.width;
  });
  readonly layerVersion = this._layerVersion.asReadonly();
  readonly lastRenderMs = this._lastRenderMs.asReadonly();
  readonly isExporting = this._isExporting.asReadonly();
  /** Set when the chosen file could not be decoded. */
  readonly loadError = this._loadError.asReadonly();

  /** Resolution the download is produced at, which is not the preview's. */
  readonly exportSize = computed(() => {
    const src = this._sourceSize();
    if (!src) return null;
    return fitWithin(
      src.width,
      src.height,
      GLASS_CONFIG.CANVAS.EXPORT_MAX_DIMENSION,
    );
  });

  /** Survives navigation, so the sidebar preview persists across routes. */
  readonly imageSlot = new ImageSlot();

  // The file as uploaded, kept so the export can re-run against it rather
  // than upscaling the capped working canvas.
  private sourceImage: HTMLImageElement | null = null;
  private sourceCanvas: HTMLCanvasElement | null = null;
  private glassLayer: HTMLCanvasElement | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;
  private rebuildGeneration = 0;

  constructor(private filtersService: GlassFiltersService) {}

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

  /** Loads an image, downscaling to the working cap, and seeds the mask. */
  setImage(img: HTMLImageElement): void {
    const max = GLASS_CONFIG.CANVAS.MAX_DIMENSION;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);

    this.sourceImage = img;
    this.sourceCanvas = canvas;
    this.glassLayer = null;
    this._hasImage.set(true);
    this._sourceSize.set({ width: img.width, height: img.height });
    this._imageSize.set({ width, height });
    this.filtersService.resetRect(width, height);
    this.rebuild();
  }

  clearImage(): void {
    this.imageSlot.clear();
    this.sourceImage = null;
    this.sourceCanvas = null;
    this.glassLayer = null;
    this._hasImage.set(false);
    this._imageSize.set(null);
    this._sourceSize.set(null);
    this._lastRenderMs.set(null);
    this._layerVersion.update((v) => v + 1);
  }

  /** Debounced entry point - coalesces slider drags into a single pass. */
  scheduleRebuild(): void {
    if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
    this.rebuildTimer = setTimeout(
      () => this.rebuild(),
      GLASS_CONFIG.REBUILD_DEBOUNCE_MS,
    );
  }

  rebuild(): void {
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
    const source = this.sourceCanvas;
    if (!source) return;

    const generation = ++this.rebuildGeneration;
    this._isProcessing.set(true);

    // Yield once so the processing flag paints before the blocking pass starts.
    setTimeout(() => {
      if (generation !== this.rebuildGeneration) return;
      try {
        const f = this.filtersService.filters();
        const custom = this.filtersService.customTexture();
        const started = performance.now();

        const transform = this.filtersService.textureTransform();
        const texture = custom
          ? textureFromImage(
              custom,
              source.width,
              source.height,
              transform,
              f.invert,
            )
          : generateTexture(
              f.texture,
              source.width,
              source.height,
              transform,
              f.invert,
            );

        this.glassLayer = this.applyGlass(
          source,
          texture,
          f.distortion,
          f.smoothness,
          f.blur,
        );
        this._lastRenderMs.set(Math.round(performance.now() - started));
        this._layerVersion.update((v) => v + 1);
      } catch (error) {
        console.error('Error building glass layer:', error);
      } finally {
        if (generation === this.rebuildGeneration) {
          this._isProcessing.set(false);
        }
      }
    }, 0);
  }

  /**
   * Paints original + masked glass layer into `target`, sized to the image.
   * Cheap enough to call on every pointer move while dragging the mask.
   */
  composite(target: HTMLCanvasElement): void {
    const source = this.sourceCanvas;
    if (!source) return;

    const { width, height } = source;
    if (target.width !== width) target.width = width;
    if (target.height !== height) target.height = height;

    const ctx = target.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0);

    const layer = this.glassLayer;
    if (!layer) return;

    const f = this.filtersService.filters();
    if (f.maskMode === 'full') {
      ctx.drawImage(layer, 0, 0);
      return;
    }

    if (!this.hasRegion()) return;

    if (f.feather > 0) {
      ctx.drawImage(this.maskedLayer(layer, f.feather), 0, 0);
    } else {
      ctx.save();
      this.traceRegion(ctx);
      ctx.clip();
      // Always at (0,0) - this is what keeps the texture locked to the photo.
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }

  private hasRegion(): boolean {
    return this.filtersService.filters().maskMode === 'polygon'
      ? this.filtersService.polygon() !== null
      : this.filtersService.rect() !== null;
  }

  /**
   * Builds the mask path. The only shape-aware code in the renderer - clip and
   * feather both consume it, so adding a shape means adding a branch here and
   * nothing else.
   */
  private traceRegion(ctx: CanvasRenderingContext2D, scale = 1): void {
    ctx.beginPath();
    if (this.filtersService.filters().maskMode === 'polygon') {
      const polygon = this.filtersService.polygon() as GlassPolygon;
      ctx.moveTo(polygon[0].x * scale, polygon[0].y * scale);
      for (let i = 1; i < polygon.length; i++) {
        ctx.lineTo(polygon[i].x * scale, polygon[i].y * scale);
      }
      ctx.closePath();
      return;
    }
    const rect = this.filtersService.rect() as GlassRect;
    ctx.rect(rect.x * scale, rect.y * scale, rect.w * scale, rect.h * scale);
  }

  /** Soft-edged reveal: blurred rect becomes the layer's alpha channel. */
  private maskedLayer(
    layer: HTMLCanvasElement,
    feather: number,
    scale = 1,
  ): HTMLCanvasElement {
    const { width, height } = layer;

    const mask = document.createElement('canvas');
    mask.width = width;
    mask.height = height;
    const maskCtx = mask.getContext('2d')!;
    maskCtx.filter = 'blur(' + feather * scale + 'px)';
    maskCtx.fillStyle = '#ffffff';
    // Same path as the hard-edged clip, so feather works for any shape.
    this.traceRegion(maskCtx, scale);
    maskCtx.fill();
    maskCtx.filter = 'none';

    const out = document.createElement('canvas');
    out.width = width;
    out.height = height;
    const outCtx = out.getContext('2d')!;
    outCtx.drawImage(layer, 0, 0);
    outCtx.globalCompositeOperation = 'destination-in';
    outCtx.drawImage(mask, 0, 0);
    return out;
  }

  /**
   * The glass filter itself.
   *
   * Photoshop's Filter Gallery > Distort > Glass treats the texture as a height
   * map and offsets each pixel by the LOCAL SLOPE of that surface - a cheap
   * refraction approximation. Sampling the raw texture value instead (what
   * SVG's feDisplacementMap does) smears rather than refracts.
   *
   * `smoothness` widens the central-difference stencil, which tames noisy or
   * JPEG-compressed height maps without blurring the photo itself.
   */
  private applyGlass(
    source: HTMLCanvasElement,
    texture: HTMLCanvasElement,
    distortion: number,
    smoothness: number,
    blurPx: number,
  ): HTMLCanvasElement {
    const w = source.width;
    const h = source.height;

    // Pre-blur = the "Gaussian Blur before Glass" step of the tutorial.
    const pre = document.createElement('canvas');
    pre.width = w;
    pre.height = h;
    const preCtx = pre.getContext('2d')!;
    if (blurPx > 0) preCtx.filter = 'blur(' + blurPx + 'px)';
    preCtx.drawImage(source, 0, 0);
    preCtx.filter = 'none';

    const src = preCtx.getImageData(0, 0, w, h).data;
    const tex = texture.getContext('2d')!.getImageData(0, 0, w, h).data;
    const out = new ImageData(w, h);
    const dst = out.data;
    const step = Math.max(1, Math.round(smoothness));

    // Height lookup, edge-clamped (texture is grayscale so R carries it all).
    const heightAt = (x: number, y: number): number => {
      const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
      const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
      return tex[(cy * w + cx) * 4];
    };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const gx = (heightAt(x + step, y) - heightAt(x - step, y)) / 255;
        const gy = (heightAt(x, y + step) - heightAt(x, y - step)) / 255;

        let sx = x + gx * distortion;
        let sy = y + gy * distortion;
        sx = sx < 0 ? 0 : sx > w - 1 ? w - 1 : sx;
        sy = sy < 0 ? 0 : sy > h - 1 ? h - 1 : sy;

        // Bilinear sample keeps edges smooth at high distortion.
        const x0 = sx | 0;
        const y0 = sy | 0;
        const x1 = x0 + 1 < w ? x0 + 1 : x0;
        const y1 = y0 + 1 < h ? y0 + 1 : y0;
        const fx = sx - x0;
        const fy = sy - y0;
        const o = (y * w + x) * 4;

        for (let c = 0; c < 3; c++) {
          const p00 = src[(y0 * w + x0) * 4 + c];
          const p10 = src[(y0 * w + x1) * 4 + c];
          const p01 = src[(y1 * w + x0) * 4 + c];
          const p11 = src[(y1 * w + x1) * 4 + c];
          dst[o + c] =
            (p00 * (1 - fx) + p10 * fx) * (1 - fy) +
            (p01 * (1 - fx) + p11 * fx) * fy;
        }
        dst[o + 3] = 255;
      }
    }

    const result = document.createElement('canvas');
    result.width = w;
    result.height = h;
    result.getContext('2d')!.putImageData(out, 0, 0);
    return result;
  }

  /**
   * Re-runs the whole effect against the original file.
   *
   * The preview works on a canvas capped at MAX_DIMENSION, and exporting that
   * gave a file a fraction of the size of the photo that went in. Upscaling it
   * would only invent pixels, so the displacement runs again at export size.
   *
   * Five separate quantities are measured in PIXELS and therefore all have to
   * scale by the same factor, or the result is a different picture rather than
   * a bigger one: the texture's spatial frequency, the distortion distance,
   * the smoothness stencil, the pre-blur radius, and the mask geometry with
   * its feather. Miss one and the glass looks finer or coarser than the
   * preview promised.
   */
  async downloadImage(): Promise<void> {
    const img = this.sourceImage;
    const working = this._imageSize();
    if (!img || !working || this._isExporting()) return;

    this._isExporting.set(true);
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
    );

    try {
      const size = fitWithin(
        img.width,
        img.height,
        GLASS_CONFIG.CANVAS.EXPORT_MAX_DIMENSION,
      );
      const factor = size.width / working.width;

      const full = document.createElement('canvas');
      full.width = size.width;
      full.height = size.height;
      full.getContext('2d')!.drawImage(img, 0, 0, size.width, size.height);

      const f = this.filtersService.filters();
      const custom = this.filtersService.customTexture();
      const transform = this.filtersService.textureTransform();
      // Scaling the UV up by the same factor keeps the pattern the same size
      // relative to the photo, since `heightAt` is sampled in pixels.
      const scaledTransform = {
        ...transform,
        scaleU: transform.scaleU * factor,
        scaleV: transform.scaleV * factor,
      };

      const texture = custom
        ? textureFromImage(
            custom,
            size.width,
            size.height,
            scaledTransform,
            f.invert,
          )
        : generateTexture(
            f.texture,
            size.width,
            size.height,
            scaledTransform,
            f.invert,
          );

      const layer = this.applyGlass(
        full,
        texture,
        f.distortion * factor,
        f.smoothness * factor,
        f.blur * factor,
      );

      const out = document.createElement('canvas');
      out.width = size.width;
      out.height = size.height;
      const ctx = out.getContext('2d')!;
      ctx.drawImage(full, 0, 0);

      if (f.maskMode === 'full') {
        ctx.drawImage(layer, 0, 0);
      } else if (this.hasRegion()) {
        if (f.feather > 0) {
          ctx.drawImage(this.maskedLayer(layer, f.feather, factor), 0, 0);
        } else {
          ctx.save();
          this.traceRegion(ctx, factor);
          ctx.clip();
          ctx.drawImage(layer, 0, 0);
          ctx.restore();
        }
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, 'image/png'),
      );
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download =
        'fractal-glass-' + new Date().toISOString().slice(0, 10) + '.png';
      link.href = url;
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting glass image:', error);
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
