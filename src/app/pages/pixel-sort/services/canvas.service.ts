import { computed, Injectable, signal } from '@angular/core';
import { PixelSortFiltersService } from './filters.service';
import { PixelSortMode } from '../constants/pixel-sort.constants';

@Injectable({
  providedIn: 'root',
})
export class PixelSortCanvasService {
  private _originalImage = signal<HTMLImageElement | null>(null);
  private _processedImage = signal<HTMLImageElement | null>(null);
  private _isProcessing = signal(false);
  private _histogramData = signal<number[]>(new Array(256).fill(0));

  readonly originalImage = this._originalImage.asReadonly();
  readonly processedImage = this._processedImage.asReadonly();
  readonly isProcessing = this._isProcessing.asReadonly();
  readonly histogramData = this._histogramData.asReadonly();

  constructor(private filtersService: PixelSortFiltersService) {}

  setOriginalImage(image: HTMLImageElement): void {
    if (!image.complete) {
      image.onload = () => {
        this._originalImage.set(image);
        this._processedImage.set(image);
        this.generateHistogram();
      };
    } else {
      this._originalImage.set(image);
      this._processedImage.set(image);
      this.generateHistogram();
    }
  }

  async processImage(): Promise<void> {
    const originalImage = this._originalImage();
    if (!originalImage) return;

    this._isProcessing.set(true);

    try {
      const filters = this.filtersService.filters();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      ctx.drawImage(originalImage, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const sortedData = await this.pixelSort(
        imageData.data,
        canvas.width,
        canvas.height,
        filters
      );

      const outputImageData = new ImageData(
        new Uint8ClampedArray(sortedData),
        canvas.width,
        canvas.height
      );

      ctx.putImageData(outputImageData, 0, 0);

      const processedImage = new Image();
      processedImage.src = canvas.toDataURL();

      await new Promise((resolve) => {
        processedImage.onload = resolve;
      });

      if (filters.stackOutput) {
        this._originalImage.set(processedImage);
      }

      this._processedImage.set(processedImage);
      this.generateHistogram();
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      this._isProcessing.set(false);
    }
  }

  resetToOriginal(): void {
    const original = this._originalImage();
    if (original) {
      this._processedImage.set(original);
      this.generateHistogram();
    }
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

  private async pixelSort(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    filters: any
  ): Promise<Uint8ClampedArray> {
    const sortedData = new Uint8ClampedArray(data.length);
    sortedData.set(data);

    try {
      const rotatedGrid = this.rotateGrid(width, height, filters.angle);
      const maxLines = Math.min(rotatedGrid.length, 10000);

      for (let i = 0; i < maxLines; i++) {
        const line = rotatedGrid[i];
        if (!line || line.length === 0) continue;

        try {
          const segments = this.breakArray(
            data,
            width,
            line,
            filters.threshold,
            filters.invert,
            filters.mode
          );

          for (const segment of segments) {
            if (segment && segment.length > 1) {
              this.sortArray(sortedData, width, segment, filters.mode);
            }
          }
        } catch (segmentError) {
          console.warn(`Error processing line ${i}:`, segmentError);
          continue;
        }
      }
    } catch (error) {
      console.error('Error in pixelSort:', error);
      return data.slice();
    }

    return sortedData;
  }

  private calculatePixelValue(
    r: number,
    g: number,
    b: number,
    mode: PixelSortMode
  ): number {
    switch (mode) {
      case 'luma':
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      case 'hue':
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max === min) return 0;
        let h = 0;
        const d = max - min;
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
      case 'saturation':
        const max2 = Math.max(r, g, b);
        const min2 = Math.min(r, g, b);
        const l = (max2 + min2) / 2;
        if (max2 === min2) return 0;
        const s =
          l > 0.5
            ? (max2 - min2) / (2 - max2 - min2)
            : (max2 - min2) / (max2 + min2);
        return s;
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

  private rotateGrid(
    width: number,
    height: number,
    angle: number
  ): Array<Array<{ x: number; y: number }>> {
    if (width === 0 || height === 0) {
      return [];
    }

    // For performance, limit complexity for large images
    // 1 megapixel limit
    if (width * height > 1000000) {
      console.warn(
        'Image too large for complex rotation, using simple row/column processing'
      );
      return this.getSimpleGrid(width, height, angle);
    }

    /* Convert angle to radians */
    const rad = (angle * Math.PI) / 180;
    const cosA = Math.cos(rad);
    const sinA = Math.sin(rad);

    /* Compute center of the array */
    const centerX = (width - 1) / 2;
    const centerY = (height - 1) / 2;

    /* Collect rotated points with bounds checking */
    const points: Array<{
      rx: number;
      ry: number;
      original: { x: number; y: number };
    }> = [];

    try {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          // Distance to center
          const dx = x - centerX;
          const dy = y - centerY;

          // Apply rotation (rx=dx⋅cosθ+dy⋅sinθ)
          const rx = dx * cosA + dy * sinA;
          const ry = -dx * sinA + dy * cosA;

          points.push({ rx, ry, original: { x, y } });
        }
      }

      // Find min values to shift into positive space
      let minX = Infinity;
      let minY = Infinity;

      for (const point of points) {
        if (point.rx < minX) minX = point.rx;
        if (point.ry < minY) minY = point.ry;
      }

      // Group by y-coordinate
      const rows = new Map<
        number,
        Array<{ x: number; original: { x: number; y: number } }>
      >();

      for (const point of points) {
        const shiftedX = Math.round(point.rx - minX);
        const shiftedY = Math.round(point.ry - minY);

        if (!rows.has(shiftedY)) {
          rows.set(shiftedY, []);
        }
        rows.get(shiftedY)!.push({ x: shiftedX, original: point.original });
      }

      // Sort each row by x and collect
      const result: Array<Array<{ x: number; y: number }>> = [];
      const sortedYKeys = Array.from(rows.keys()).sort((a, b) => a - b);

      for (const y of sortedYKeys) {
        const row = rows.get(y)!;
        row.sort((a, b) => a.x - b.x);
        result.push(row.map((item) => item.original));
      }

      return result;
    } catch (error) {
      console.error('Error in rotateGrid, falling back to simple grid:', error);
      return this.getSimpleGrid(width, height, angle);
    }
  }

  private getSimpleGrid(
    width: number,
    height: number,
    angle: number
  ): Array<Array<{ x: number; y: number }>> {
    /*
     * Generates a simplified grid of pixel coordinates organized into lines based on a specified angle.
     * This is a performance-optimized alternative to full coordinate rotation, supporting four primary
     */

    const result: Array<Array<{ x: number; y: number }>> = [];

    /* Normalize angle to 0-360 */
    const normalizedAngle = ((angle % 360) + 360) % 360;

    if (normalizedAngle >= 315 || normalizedAngle < 45) {
      // Horizontal lines (0°)
      for (let y = 0; y < height; y++) {
        const row: Array<{ x: number; y: number }> = [];
        for (let x = 0; x < width; x++) {
          row.push({ x, y });
        }
        result.push(row);
      }
    } else if (normalizedAngle >= 45 && normalizedAngle < 135) {
      // Diagonal lines (45-135°)
      for (let d = 0; d < width + height - 1; d++) {
        const diagonal: Array<{ x: number; y: number }> = [];
        for (let x = 0; x < width; x++) {
          const y = d - x;
          if (y >= 0 && y < height) {
            diagonal.push({ x, y });
          }
        }
        if (diagonal.length > 0) {
          result.push(diagonal);
        }
      }
    } else if (normalizedAngle >= 135 && normalizedAngle < 225) {
      // Vertical lines (90°)
      for (let x = 0; x < width; x++) {
        const column: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < height; y++) {
          column.push({ x, y });
        }
        result.push(column);
      }
    } else {
      // Diagonal lines (225-315°)
      for (let d = 0; d < width + height - 1; d++) {
        const diagonal: Array<{ x: number; y: number }> = [];
        for (let x = 0; x < width; x++) {
          const y = d - (width - 1 - x);
          if (y >= 0 && y < height) {
            diagonal.push({ x, y });
          }
        }
        if (diagonal.length > 0) {
          result.push(diagonal);
        }
      }
    }

    return result;
  }

  private breakArray(
    data: Uint8ClampedArray,
    width: number,
    coords: Array<{ x: number; y: number }>,
    threshold: number,
    invert: boolean,
    mode: string
  ): Array<Array<{ x: number; y: number }>> {
    if (!coords || coords.length === 0) {
      return [];
    }

    const arrays: Array<Array<{ x: number; y: number }>> = [];
    let currentArray: Array<{ x: number; y: number }> = [];

    try {
      for (let i = 0; i < coords.length; i++) {
        const coord = coords[i];

        // Bounds checking
        if (
          coord.x < 0 ||
          coord.x >= width ||
          coord.y < 0 ||
          coord.y >= data.length / (width * 4)
        ) {
          continue;
        }

        const idx = (coord.y * width + coord.x) * 4;

        // Bounds checking for data array
        if (idx + 2 >= data.length) {
          continue;
        }

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const pixelValue =
          this.calculatePixelValue(r, g, b, mode as PixelSortMode) * 255;
        const meetsCondition = invert
          ? pixelValue < threshold
          : pixelValue >= threshold;

        if (!meetsCondition) {
          if (currentArray.length > 0) {
            arrays.push([...currentArray]); // Create a copy
            currentArray = [];
          }
        } else {
          currentArray.push(coord);
        }
      }

      if (currentArray.length > 0) {
        arrays.push(currentArray);
      }
    } catch (error) {
      console.warn('Error in breakArray:', error);
      return [];
    }

    return arrays;
  }

  private sortArray(
    data: Uint8ClampedArray,
    width: number,
    coords: Array<{ x: number; y: number }>,
    mode: string
  ): void {
    if (!coords || coords.length <= 1) return;

    try {
      // Extract pixels with their values
      const pixels: Array<{
        value: number;
        r: number;
        g: number;
        b: number;
        a: number;
        coord: { x: number; y: number };
      }> = [];

      for (const coord of coords) {
        // Bounds checking
        if (coord.x < 0 || coord.x >= width || coord.y < 0) {
          continue;
        }

        const idx = (coord.y * width + coord.x) * 4;

        // Bounds checking for data array
        if (idx + 3 >= data.length) {
          continue;
        }

        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        const value = this.calculatePixelValue(r, g, b, mode as PixelSortMode);

        pixels.push({ value, r, g, b, a, coord });
      }

      if (pixels.length <= 1) return;

      // Sort by pixel value
      pixels.sort((a, b) => a.value - b.value);

      // Write sorted pixels back
      for (let i = 0; i < Math.min(pixels.length, coords.length); i++) {
        const pixel = pixels[i];
        const coord = coords[i];

        if (!coord || !pixel) continue;

        const idx = (coord.y * width + coord.x) * 4;

        // Bounds checking
        if (idx + 3 < data.length) {
          data[idx] = pixel.r;
          data[idx + 1] = pixel.g;
          data[idx + 2] = pixel.b;
          data[idx + 3] = pixel.a;
        }
      }
    } catch (error) {
      console.warn('Error in sortArray:', error);
    }
  }
}
