import { computed, Injectable, signal } from '@angular/core';
import { PixelSortFiltersService } from './filters.service';
import { PixelSortMaskService } from './mask.service';
import { PixelSortMode } from '../constants/pixel-sort.constants';
import { ImageSlot } from '@shared/utils/image-slot';
import { IMAGE_DECODE_ERROR, decodeImage } from '@shared/utils/decode-image';
import { ZoomLevel } from '@shared/utils/zoom';

@Injectable({
  providedIn: 'root',
})
export class PixelSortCanvasService {
  private _originalImage = signal<HTMLImageElement | null>(null);
  private _processedImage = signal<HTMLImageElement | null>(null);
  private _isProcessing = signal(false);
  private _loadError = signal<string | null>(null);
  private _histogramData = signal<number[]>(new Array(256).fill(0));

  readonly originalImage = this._originalImage.asReadonly();
  readonly processedImage = this._processedImage.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  /** Set when the chosen file could not be decoded. */
  readonly loadError = this._loadError.asReadonly();
  readonly histogramData = this._histogramData.asReadonly();

  /** Survives navigation, so the sidebar preview persists across routes. */
  readonly imageSlot = new ImageSlot();

  // Display-only state: changing it never touches the pixel data, so the
  // exported file is the same at any zoom level.
  private _zoom = signal<ZoomLevel>('fit');
  private _effectiveScale = signal(1);

  readonly zoom = this._zoom.asReadonly();
  readonly effectiveScale = this._effectiveScale.asReadonly();

  setZoom(zoom: ZoomLevel): void {
    this._zoom.set(zoom);
  }

  setEffectiveScale(scale: number): void {
    this._effectiveScale.set(scale);
  }

  // Generation counter to discard stale async results
  private _processGeneration = 0;

  // Active object URLs owned by this service. Kept alive for the lifetime
  // of their HTMLImageElement (the <img> in canvas.component.html binds src
  // directly). Revoked when the element is replaced to avoid leaks.
  // NOTE: revoking immediately after img.onload (old approach) caused the
  // processed image to break - Angular's [src] rebind hit a dead URL.
  private _originalObjectUrl: string | null = null;
  private _processedObjectUrl: string | null = null;

  constructor(
    private filtersService: PixelSortFiltersService,
    private maskService: PixelSortMaskService,
  ) {}

  /**
   * Entry point from the upload control: remembers the file, then decodes it.
   *
   * A file that cannot be decoded clears the slot rather than leaving it half
   * loaded, since the preview would fail on the same bytes and leave a broken
   * thumbnail under a filename implying success.
   */
  async loadFile(file: File): Promise<void> {
    this._loadError.set(null);
    const url = this.imageSlot.set(file);
    try {
      this.setOriginalImage(await decodeImage(url));
    } catch {
      this.clearImage();
      this._loadError.set(IMAGE_DECODE_ERROR);
    }
  }

  clearImage(): void {
    this.imageSlot.clear();
    this.revokeOwnedObjectUrls();
    this._originalImage.set(null);
    this._processedImage.set(null);
    this._histogramData.set(new Array(256).fill(0));
  }

  setOriginalImage(image: HTMLImageElement): void {
    const apply = () => {
      this.revokeOwnedObjectUrls();
      this._originalImage.set(image);
      this._processedImage.set(image);
      this.maskService.initMask(image.width, image.height);
      this.generateHistogram();
    };

    if (!image.complete) {
      image.onload = () => apply();
    } else {
      apply();
    }
  }

  async processImage(): Promise<void> {
    const originalImage = this._originalImage();
    if (!originalImage) return;

    const gen = ++this._processGeneration;
    this._isProcessing.set(true);
    // Wait for an actual painted frame before starting the blocking sort.
    // A setTimeout only yields the task; it does not guarantee the browser
    // gets to paint, so the indicator could still miss its turn. Two nested
    // animation frames do: the first lands after change detection, the second
    // after the frame carrying it has been shown.
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve(null))),
    );
    if (gen !== this._processGeneration) return;

    try {
      const filters = this.filtersService.filters();

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      ctx.drawImage(originalImage, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const sortedData = filters.circularSort
        ? this.pixelSortCircular(imageData.data, canvas.width, canvas.height, {
            ...filters,
            pivot: this.filtersService.pivot(),
          })
        : this.pixelSort(imageData.data, canvas.width, canvas.height, filters);

      if (gen !== this._processGeneration) return;

      const finalData = this.applyMaskCompositing(
        imageData.data,
        sortedData,
        canvas.width,
        canvas.height,
      );

      if (gen !== this._processGeneration) return;

      const outputImageData = new ImageData(
        new Uint8ClampedArray(finalData),
        canvas.width,
        canvas.height,
      );

      ctx.putImageData(outputImageData, 0, 0);

      const { img: processedImage, url: processedUrl } =
        await this.canvasToImage(canvas);
      if (gen !== this._processGeneration) {
        // Stale result: nobody will reference this URL, dispose it.
        URL.revokeObjectURL(processedUrl);
        return;
      }

      if (filters.stackOutput) {
        // Promote processed → original. Old original/processed URLs are
        // no longer referenced and must be revoked.
        this.revokeOwnedObjectUrls();
        this._originalObjectUrl = processedUrl;
        this._originalImage.set(processedImage);
        this.maskService.initMask(processedImage.width, processedImage.height);
      } else {
        // Replace the processed slot (revoke old one if not shared w/ original).
        if (
          this._processedObjectUrl &&
          this._processedObjectUrl !== this._originalObjectUrl
        ) {
          URL.revokeObjectURL(this._processedObjectUrl);
        }
        this._processedObjectUrl = processedUrl;
      }

      this._processedImage.set(processedImage);
      this.generateHistogram();
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      if (gen === this._processGeneration) {
        this._isProcessing.set(false);
      }
    }
  }

  /**
   * Converts a canvas to HTMLImageElement via toBlob + URL.createObjectURL.
   * More memory-efficient than toDataURL (no base64 string overhead).
   * Returns the object URL alongside the image - the caller MUST keep the
   * URL alive for the lifetime of the image (Angular's [src]="img.src"
   * binding needs a live URL) and revoke it when the image is replaced.
   */
  private canvasToImage(
    canvas: HTMLCanvasElement,
  ): Promise<{ img: HTMLImageElement; url: string }> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('toBlob failed'));
          return;
        }
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => resolve({ img, url });
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Image load failed'));
        };
        img.src = url;
      }, 'image/png');
    });
  }

  /**
   * Revokes every object URL currently owned by this service.
   * Safe to call any time - only revokes non-null URLs, dedupes to avoid
   * double-revoke on shared URLs (stackOutput promotion case).
   */
  private revokeOwnedObjectUrls(): void {
    const urls = new Set<string>();
    if (this._originalObjectUrl) urls.add(this._originalObjectUrl);
    if (this._processedObjectUrl) urls.add(this._processedObjectUrl);
    urls.forEach((u) => URL.revokeObjectURL(u));
    this._originalObjectUrl = null;
    this._processedObjectUrl = null;
  }

  resetToOriginal(): void {
    const original = this._originalImage();
    if (!original) return;

    // Old processed image is being discarded; revoke its URL unless it is
    // shared with the original (stackOutput case).
    if (
      this._processedObjectUrl &&
      this._processedObjectUrl !== this._originalObjectUrl
    ) {
      URL.revokeObjectURL(this._processedObjectUrl);
    }
    this._processedObjectUrl = null;

    this._processedImage.set(original);
    this.generateHistogram();
  }

  generateHistogram(): void {
    const image = this._processedImage();
    const filters = this.filtersService.filters();

    if (!image) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const histogram = new Array(256).fill(0);

    for (let i = 0; i < imageData.data.length; i += 4) {
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      const pixelValue = this.calculatePixelValue(r, g, b, filters.mode) * 255;
      histogram[Math.floor(pixelValue)]++;
    }

    this._histogramData.set(histogram);
  }

  downloadImage(): void {
    const image = this._processedImage() || this._originalImage();
    if (!image) return;

    const link = document.createElement('a');
    link.download = `pixel-sort-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = image.src;
    link.click();
    link.remove();
  }

  // ── Pixel Sort algorithm (main thread) ──

  private pixelSort(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    filters: any,
  ): Uint8ClampedArray {
    const sortedData = new Uint8ClampedArray(data.length);
    sortedData.set(data);

    const rotatedGrid = this.rotateGrid(width, height, filters.angle);

    for (let i = 0; i < rotatedGrid.length; i++) {
      const line = rotatedGrid[i];
      if (!line || line.length === 0) continue;

      const segments = this.breakArray(
        data,
        width,
        line,
        filters.threshold,
        filters.invert,
        filters.mode,
      );

      for (const segment of segments) {
        if (segment && segment.length > 1) {
          this.sortArray(sortedData, width, segment, filters.mode);
        }
      }
    }

    return sortedData;
  }

  /**
   * Circular pixel sort: buckets every pixel by its distance from the pivot,
   * then sorts each ring along the angular axis.
   *
   * A ring is ordered by θ = atan2(y - py, x - px) and then handed to the same
   * `breakArray` and `sortArray` the linear sort uses, so thresholding behaves
   * identically along the circle. The result is a swirl centred on the pivot.
   *
   * Memory: O(width * height) for the bucket arrays, same as rotateGrid.
   */
  private pixelSortCircular(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    filters: any,
  ): Uint8ClampedArray {
    const sortedData = new Uint8ClampedArray(data.length);
    sortedData.set(data);

    const pivot = filters.pivot
      ? filters.pivot
      : { x: (width - 1) / 2, y: (height - 1) / 2 };

    // Max radius = distance from pivot to the farthest corner.
    const corners = [
      { x: 0, y: 0 },
      { x: width - 1, y: 0 },
      { x: 0, y: height - 1 },
      { x: width - 1, y: height - 1 },
    ];
    let maxRadius = 0;
    for (const c of corners) {
      const d = Math.sqrt((c.x - pivot.x) ** 2 + (c.y - pivot.y) ** 2);
      if (d > maxRadius) maxRadius = d;
    }
    maxRadius = Math.ceil(maxRadius);
    if (maxRadius <= 0) return sortedData;

    // Bucket every pixel by its rounded radius. Each bucket entry stores the
    // pixel coordinate and its angle θ so we can sort the ring angularly.
    type BucketEntry = { x: number; y: number; theta: number };
    const buckets: Array<Array<BucketEntry>> = new Array(maxRadius + 1);
    for (let i = 0; i <= maxRadius; i++) buckets[i] = [];

    for (let y = 0; y < height; y++) {
      const dy = y - pivot.y;
      for (let x = 0; x < width; x++) {
        const dx = x - pivot.x;
        const r = Math.round(Math.sqrt(dx * dx + dy * dy));
        if (r >= 0 && r <= maxRadius) {
          buckets[r].push({ x, y, theta: Math.atan2(dy, dx) });
        }
      }
    }

    // Sort each ring by angle, then run threshold segmentation + sort on it.
    for (const bucket of buckets) {
      if (bucket.length < 2) continue;
      bucket.sort((a, b) => a.theta - b.theta);

      // Strip theta - breakArray/sortArray expect {x, y} coords.
      const ring: Array<{ x: number; y: number }> = new Array(bucket.length);
      for (let i = 0; i < bucket.length; i++) {
        ring[i] = { x: bucket[i].x, y: bucket[i].y };
      }

      const segments = this.breakArray(
        data,
        width,
        ring,
        filters.threshold,
        filters.invert,
        filters.mode,
      );

      // Merge wrapped segments: atan2 has its discontinuity at ±π (the left
      // side of the pivot), so the ring array starts and ends there. If an
      // active segment crosses that seam, breakArray splits it into two
      // pieces - one at the start of the array, one at the end. Without
      // merging, each half gets sorted independently, producing a visible
      // "scarf" artifact on the left side. Detect and rejoin them.
      if (segments.length >= 2) {
        const firstSeg = segments[0];
        const lastSeg = segments[segments.length - 1];
        const firstStartsAtSeam = firstSeg[0] === ring[0];
        const lastEndsAtSeam =
          lastSeg[lastSeg.length - 1] === ring[ring.length - 1];
        if (firstStartsAtSeam && lastEndsAtSeam) {
          // Concatenate last + first so the merged segment is contiguous
          // along the circle. sortArray reorders by pixel value and writes
          // back to the coords in order - the starting position within the
          // circular segment doesn't affect the result.
          segments[0] = [...lastSeg, ...firstSeg];
          segments.pop();
        }
      }

      for (const segment of segments) {
        if (segment && segment.length > 1) {
          this.sortArray(sortedData, width, segment, filters.mode);
        }
      }
    }

    return sortedData;
  }

  private applyMaskCompositing(
    originalData: Uint8ClampedArray,
    sortedData: Uint8ClampedArray,
    width: number,
    height: number,
  ): Uint8ClampedArray {
    if (!this.maskService.isActive()) {
      return sortedData;
    }

    const maskData = this.maskService.getMaskImageData();
    if (!maskData) return sortedData;

    const result = new Uint8ClampedArray(originalData.length);

    for (let i = 0; i < originalData.length; i += 4) {
      const maskAlpha = maskData.data[i + 3] / 255;
      result[i] = Math.round(
        originalData[i] * (1 - maskAlpha) + sortedData[i] * maskAlpha,
      );
      result[i + 1] = Math.round(
        originalData[i + 1] * (1 - maskAlpha) + sortedData[i + 1] * maskAlpha,
      );
      result[i + 2] = Math.round(
        originalData[i + 2] * (1 - maskAlpha) + sortedData[i + 2] * maskAlpha,
      );
      result[i + 3] = originalData[i + 3];
    }

    return result;
  }

  private calculatePixelValue(
    r: number,
    g: number,
    b: number,
    mode: PixelSortMode,
  ): number {
    switch (mode) {
      case 'luma':
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      case 'hue': {
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max === min) return 0;
        const d = max - min;
        let h = 0;
        switch (max) {
          case r:
            h = (g - b) / d + (g < b ? 6 : 0);
            break;
          case g:
            h = (b - r) / d + 2;
            break;
          case b:
            h = (r - g) / d + 4;
            break;
        }
        return h / 6;
      }
      case 'saturation': {
        const max2 = Math.max(r, g, b);
        const min2 = Math.min(r, g, b);
        if (max2 === min2) return 0;
        const l = (max2 + min2) / 2;
        return l > 0.5
          ? (max2 - min2) / (2 - max2 - min2)
          : (max2 - min2) / (max2 + min2);
      }
      case 'red_green_ratio':
        return g === 0 ? 1 : r / g;
      case 'blue_emphasis':
        return (b - (r + g) / 2) / 255;
      case 'luminance':
        return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      case 'euclidean_distance':
        return Math.sqrt(r * r + g * g + b * b) / (255 * Math.sqrt(3));
      case 'cmy_cyan':
        return 1 - r / 255;
      case 'cmy_magenta':
        return 1 - g / 255;
      case 'cmy_yellow':
        return 1 - b / 255;
      case 'xor':
        return (r ^ g ^ b) / 255;
      case 'modulo':
        return ((r + g + b) % 255) / 255;
      default:
        return (r + g + b) / (3 * 255);
    }
  }

  /**
   * Buckets every pixel into scanlines perpendicular to the sort direction.
   *
   * For angle θ, the sort direction is (cos θ, sin θ) and the perpendicular
   * axis is (-sin θ, cos θ). Each pixel (x, y) is assigned to scanline
   * p = round(x * (-sin0) + y * cos0). Pixels sharing the same p form one
   * scanline, ordered along the sort direction by x * cos0 + y * sin0.
   *
   * Every pixel lands in exactly one scanline at any angle, in
   * O(width * height) for the coord objects.
   */
  private rotateGrid(
    width: number,
    height: number,
    angle: number,
  ): Array<Array<{ x: number; y: number }>> {
    if (width === 0 || height === 0) return [];

    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const px = -dy;
    const py = dx;

    // Projection range of the 4 corners onto the perpendicular axis -
    // determines how many scanline buckets we need.
    const corners = [
      { x: 0, y: 0 },
      { x: width - 1, y: 0 },
      { x: 0, y: height - 1 },
      { x: width - 1, y: height - 1 },
    ];
    let projMin = Infinity;
    let projMax = -Infinity;
    for (const c of corners) {
      const proj = c.x * px + c.y * py;
      if (proj < projMin) projMin = proj;
      if (proj > projMax) projMax = proj;
    }
    const startP = Math.floor(projMin);
    const endP = Math.ceil(projMax);
    const numBuckets = endP - startP + 1;
    if (numBuckets <= 0) return [];

    const buckets: Array<Array<{ x: number; y: number; t: number }>> =
      new Array(numBuckets);
    for (let i = 0; i < numBuckets; i++) buckets[i] = [];

    // Single pass over all pixels: assign each to its perpendicular bucket.
    // `t` (projection onto sort direction) is computed once here so the
    // intra-line sort below doesn't recompute it per comparison.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = Math.round(x * px + y * py);
        const idx = p - startP;
        if (idx >= 0 && idx < numBuckets) {
          buckets[idx].push({ x, y, t: x * dx + y * dy });
        }
      }
    }

    // Sort each bucket by position along the scanline (t) so segments
    // broken by threshold are contiguous along the line direction.
    const result: Array<Array<{ x: number; y: number }>> = [];
    for (const bucket of buckets) {
      if (bucket.length === 0) continue;
      bucket.sort((a, b) => a.t - b.t);
      // Strip t before returning - downstream code expects {x, y} only.
      const line: Array<{ x: number; y: number }> = new Array(bucket.length);
      for (let i = 0; i < bucket.length; i++) {
        line[i] = { x: bucket[i].x, y: bucket[i].y };
      }
      result.push(line);
    }

    return result;
  }

  private breakArray(
    data: Uint8ClampedArray,
    width: number,
    coords: Array<{ x: number; y: number }>,
    threshold: number,
    invert: boolean,
    mode: string,
  ): Array<Array<{ x: number; y: number }>> {
    if (!coords || coords.length === 0) return [];

    const arrays: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];

    for (let i = 0; i < coords.length; i++) {
      const coord = coords[i];
      if (
        coord.x < 0 ||
        coord.x >= width ||
        coord.y < 0 ||
        coord.y >= data.length / (width * 4)
      )
        continue;

      const idx = (coord.y * width + coord.x) * 4;
      if (idx + 2 >= data.length) continue;

      const pixelValue =
        this.calculatePixelValue(
          data[idx],
          data[idx + 1],
          data[idx + 2],
          mode as PixelSortMode,
        ) * 255;
      const meets = invert ? pixelValue < threshold : pixelValue >= threshold;

      if (!meets) {
        if (current.length > 0) {
          arrays.push([...current]);
          current = [];
        }
      } else {
        current.push(coord);
      }
    }

    if (current.length > 0) arrays.push(current);
    return arrays;
  }

  private sortArray(
    data: Uint8ClampedArray,
    width: number,
    coords: Array<{ x: number; y: number }>,
    mode: string,
  ): void {
    if (!coords || coords.length <= 1) return;

    const pixels: Array<{
      value: number;
      r: number;
      g: number;
      b: number;
      a: number;
      coord: { x: number; y: number };
    }> = [];

    for (const coord of coords) {
      if (coord.x < 0 || coord.x >= width || coord.y < 0) continue;
      const idx = (coord.y * width + coord.x) * 4;
      if (idx + 3 >= data.length) continue;

      pixels.push({
        value: this.calculatePixelValue(
          data[idx],
          data[idx + 1],
          data[idx + 2],
          mode as PixelSortMode,
        ),
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3],
        coord,
      });
    }

    if (pixels.length <= 1) return;
    pixels.sort((a, b) => a.value - b.value);

    for (let i = 0; i < Math.min(pixels.length, coords.length); i++) {
      const pixel = pixels[i];
      const coord = coords[i];
      if (!coord || !pixel) continue;
      const idx = (coord.y * width + coord.x) * 4;
      if (idx + 3 < data.length) {
        data[idx] = pixel.r;
        data[idx + 1] = pixel.g;
        data[idx + 2] = pixel.b;
        data[idx + 3] = pixel.a;
      }
    }
  }
}
