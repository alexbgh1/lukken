import {
  Component,
  ElementRef,
  effect,
  ViewChild,
  Input,
  Output,
  EventEmitter,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { FiltersDataService } from '../services/filters-data.service';
import { DeadPixelsCanvasService } from '../services/canvas.service';
import {
  CanvasFilters,
  DeadPixel,
  PixelType,
} from '@interfaces/dead-pixels.interface';
import { PIXEL_DETECTION, SENSITIVITY } from '../constants/canvas.constants';

@Component({
  selector: 'dead-pixels-canvas',
  template: `
    <div class="relative">
      <canvas
        #deadPixelsCanvas
        [class]="canvasClass"
        [style.transform-origin]="transformOrigin"
      ></canvas>
      @if (isProcessing()) {
      <div
        class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"
      >
        <div class="text-white">Processing image...</div>
      </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    `,
  ],
})
export class DeadPixelsCanvasComponent {
  @ViewChild('deadPixelsCanvas', { static: true })
  canvasRef!: ElementRef<HTMLCanvasElement>;

  // Inputs to customize the canvas
  @Input() canvasClass = 'bg-bg-canvas max-w-full';
  @Input() transform = '';
  @Input() transformOrigin = '0 0';
  @Input() useFiltersService = true;
  @Input() customImage: HTMLImageElement | null = null;
  @Input() customSensitivity: number | null = null;
  @Input() showHighlights = true;

  // Outputs
  @Output() imageProcessed = new EventEmitter<{
    deadPixels: DeadPixel[];
    imageData: ImageData;
  }>();
  @Output() processingStateChange = new EventEmitter<boolean>();

  PIXEL_DETECTION = PIXEL_DETECTION;

  private ctx!: CanvasRenderingContext2D;
  private originalImageData: ImageData | null = null;
  private detectedPixels: DeadPixel[] = [];

  isProcessing = signal(false);

  constructor(
    private filtersData: FiltersDataService,
    private canvasService: DeadPixelsCanvasService
  ) {
    effect(() => {
      if (this.useFiltersService) {
        const filters = this.filtersData.currentFilters();
        if (filters && filters.image) {
          this.processImage(filters);
        }
      }
    });

    effect(() => {
      if (!this.useFiltersService && this.customImage) {
        const sensitivity = this.customSensitivity || SENSITIVITY.DEFAULT;
        this.processCustomImage(this.customImage, sensitivity);
      }
    });

    effect(() => {
      if (this.originalImageData && this.detectedPixels.length > 0) {
        this.applyHighlights();
      }
    });

    effect(() => {
      const shouldHighlight = this.canvasService.highlight();
      console.log('Canvas received highlight change:', shouldHighlight);
      this.toggleHighlights(shouldHighlight);
    });
  }

  private async processImage(filters: CanvasFilters): Promise<void> {
    this.setProcessing(true);

    if (!filters.image) {
      this.setProcessing(false);
      return;
    }

    try {
      const img = await this.loadImage(filters.image);
      this.drawImageAndDetectPixels(img, filters.sensitivity);
    } catch (error) {
      console.error('Error processing image:', error);
    }

    this.setProcessing(false);
  }

  private processCustomImage(img: HTMLImageElement, sensitivity: number): void {
    if (!img.complete) {
      img.onload = () => this.processCustomImage(img, sensitivity);
      return;
    }

    this.setProcessing(true);
    this.drawImageAndDetectPixels(img, sensitivity);
    this.setProcessing(false);
  }

  private setProcessing(state: boolean): void {
    this.isProcessing.set(state);
    this.processingStateChange.emit(state);
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private drawImageAndDetectPixels(
    img: HTMLImageElement,
    sensitivity: number
  ): void {
    if (!this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    canvas.width = img.width;
    canvas.height = img.height;

    this.ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    this.ctx.drawImage(img, 0, 0);

    const imageData = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
    this.originalImageData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );

    const deadPixels = this.detectDeadPixels(imageData, sensitivity);
    this.detectedPixels = deadPixels;

    this.applyHighlights();

    const processedData = {
      deadPixels,
      imageData: this.originalImageData!,
    };

    this.imageProcessed.emit(processedData);

    // If using the filters service, update the dead pixels data
    if (this.useFiltersService) {
      this.canvasService.updateDeadPixelsData(processedData);
    }
  }

  private applyHighlights(): void {
    if (!this.originalImageData || !this.ctx) return;

    if (this.showHighlights && this.detectedPixels.length > 0) {
      this.highlightDeadPixels(this.detectedPixels);
    } else {
      this.ctx.putImageData(this.originalImageData, 0, 0);
    }
  }

  public toggleHighlights(show: boolean): void {
    this.showHighlights = show;
    this.applyHighlights();
  }

  public getDetectedPixels() {
    return this.detectedPixels;
  }

  public getOriginalImageData() {
    return this.originalImageData;
  }

  private detectDeadPixels(
    imageData: ImageData,
    sensitivity: number
  ): DeadPixel[] {
    const { data, width, height } = imageData;
    const deadPixels: DeadPixel[] = [];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = (y * width + x) * 4;
        const r = data[index + PIXEL_DETECTION.COLOR_CHANNELS.RED];
        const g = data[index + PIXEL_DETECTION.COLOR_CHANNELS.GREEN];
        const b = data[index + PIXEL_DETECTION.COLOR_CHANNELS.BLUE];

        // Dead pixel (completely black pixel)
        if (
          r <= PIXEL_DETECTION.DEAD_THRESHOLD &&
          g <= PIXEL_DETECTION.DEAD_THRESHOLD &&
          b <= PIXEL_DETECTION.DEAD_THRESHOLD
        ) {
          deadPixels.push({ x, y, type: PixelType.DEAD });
          continue;
        }

        // Hot pixel (completely white)
        if (
          r >= PIXEL_DETECTION.HOT_THRESHOLD &&
          g >= PIXEL_DETECTION.HOT_THRESHOLD &&
          b >= PIXEL_DETECTION.HOT_THRESHOLD
        ) {
          deadPixels.push({ x, y, type: PixelType.HOT });
          continue;
        }

        // Stuck pixel detection
        if (this.isStuckPixel(x, y, data, width, height, sensitivity)) {
          deadPixels.push({ x, y, type: PixelType.STUCK });
        }
      }
    }

    return deadPixels;
  }

  private isStuckPixel(
    x: number,
    y: number,
    data: Uint8ClampedArray,
    width: number,
    height: number,
    sensitivity: number
  ): boolean {
    /*
      Stuck pixel detection logic:
      A pixel is considered stuck if its color is significantly different
      from its neighbors. The sensitivity parameter controls how much
      difference is required to classify a pixel as stuck.
    */
    const pixelIndex = (y * width + x) * 4;
    const r = data[pixelIndex + PIXEL_DETECTION.COLOR_CHANNELS.RED];
    const g = data[pixelIndex + PIXEL_DETECTION.COLOR_CHANNELS.GREEN];
    const b = data[pixelIndex + PIXEL_DETECTION.COLOR_CHANNELS.BLUE];

    // Neighbors for stuck pixel detection
    /* e.g.:
      [-1, -1]  [-1, 0]  [-1, 1]
      [0, -1]    PIXEL    [0, 1]
      [1, -1]   [1, 0]   [1, 1]
      */

    const neighbors = [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [0, -1],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ];

    let totalDiff = 0;
    let validNeighbors = 0;

    for (const [dx, dy] of neighbors) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const neighborIndex = (ny * width + nx) * 4;
        const nr = data[neighborIndex + PIXEL_DETECTION.COLOR_CHANNELS.RED];
        const ng = data[neighborIndex + PIXEL_DETECTION.COLOR_CHANNELS.GREEN];
        const nb = data[neighborIndex + PIXEL_DETECTION.COLOR_CHANNELS.BLUE];

        const diff = Math.abs(r - nr) + Math.abs(g - ng) + Math.abs(b - nb);
        totalDiff += diff;
        validNeighbors++;
      }
    }

    const avgDiff = validNeighbors > 0 ? totalDiff / validNeighbors : 0;
    return avgDiff > sensitivity;
  }

  private highlightDeadPixels(deadPixels: DeadPixel[]): void {
    if (!this.originalImageData || !this.ctx) return;

    // Save the original image data
    const imageData = new ImageData(
      new Uint8ClampedArray(this.originalImageData.data),
      this.originalImageData.width,
      this.originalImageData.height
    );

    // Apply highlights
    deadPixels.forEach((pixel) => {
      const index = (pixel.y * imageData.width + pixel.x) * 4;
      let color: number[];

      switch (pixel.type) {
        case PixelType.DEAD:
          color = PIXEL_DETECTION.HIGHLIGHT_COLORS.DEAD;
          break;
        case PixelType.HOT:
          color = PIXEL_DETECTION.HIGHLIGHT_COLORS.HOT;
          break;
        case PixelType.STUCK:
          color = PIXEL_DETECTION.HIGHLIGHT_COLORS.STUCK;
          break;
        default:
          return;
      }

      imageData.data[index + PIXEL_DETECTION.COLOR_CHANNELS.RED] = color[0];
      imageData.data[index + PIXEL_DETECTION.COLOR_CHANNELS.GREEN] = color[1];
      imageData.data[index + PIXEL_DETECTION.COLOR_CHANNELS.BLUE] = color[2];
    });

    this.ctx.putImageData(imageData, 0, 0);
  }
}
