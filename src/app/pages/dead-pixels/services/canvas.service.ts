import { effect, inject, Injectable, signal } from '@angular/core';
import { FiltersDataService } from './filters-data.service';
import {
  PIXEL_DETECTION,
  SAVED_CANVAS_NAME,
  ZOOM_CONFIG,
} from '../constants/canvas.constants';
import {
  DeadPixel,
  PixelType,
} from '../../../interfaces/dead-pixels.interface';

/*
  * CanvasService is responsible for managing the canvas state and operations
  * related to dead pixels analysis, including image loading, pixel detection,
  * and interaction with the FiltersDataService.

*/

@Injectable({
  providedIn: 'root',
})
export class DeadPixelsCanvasService {
  public filtersService = inject(FiltersDataService);

  private highlightSignal = signal(true);
  private modalHighlightSignal = signal(true);
  private zoomSignal = signal(ZOOM_CONFIG.DEFAULT);
  private panSignal = signal({
    x: ZOOM_CONFIG.PAN.DEFAULT_X,
    y: ZOOM_CONFIG.PAN.DEFAULT_Y,
  });
  private modalOpenSignal = signal(false);
  private canvasImageSignal = signal<HTMLImageElement | null>(null);
  private deadPixelsDataSignal = signal<{
    deadPixels: DeadPixel[];
    imageData: ImageData | null;
  }>({
    deadPixels: [],
    imageData: null,
  });

  // Expose as read-only signals
  highlight = this.highlightSignal.asReadonly();
  modalHighlight = this.modalHighlightSignal.asReadonly();
  zoom = this.zoomSignal.asReadonly();
  pan = this.panSignal.asReadonly();
  isModalOpen = this.modalOpenSignal.asReadonly();
  canvasImage = this.canvasImageSignal.asReadonly();
  deadPixelsData = this.deadPixelsDataSignal.asReadonly();

  constructor() {
    effect(() => {
      const filters = this.filtersService.currentFilters();

      if (filters?.image) {
        this.loadImageFromFile(filters.image);
      }
    });
  }

  // Load an image from a file input
  // blob image
  private async loadImageFromFile(file: File): Promise<void> {
    try {
      const img = new Image();
      const url = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          // Updating to  ModalComponent
          this.canvasImageSignal.set(img);
          URL.revokeObjectURL(url);
          resolve();
        };

        // img.src is necessary to trigger the loading
        img.onerror = reject;
        img.src = url;
      });
    } catch (error) {
      console.error('Error loading image:', error);
      this.canvasImageSignal.set(null);
    }
  }

  toggleHighlight(value?: boolean): void {
    if (value !== undefined) {
      this.highlightSignal.set(value);
    } else {
      this.highlightSignal.update((v) => !v);
    }
  }

  updateModalHighlight(value: boolean): void {
    this.modalHighlightSignal.set(value);
  }

  updateZoom(level: number): void {
    const clampedLevel = Math.min(
      Math.max(level, ZOOM_CONFIG.MIN),
      ZOOM_CONFIG.MAX
    );
    this.zoomSignal.set(clampedLevel);
  }

  updatePan(offset: { x: number; y: number }): void {
    this.panSignal.set({
      x: offset.x,
      y: offset.y,
    });
  }

  zoomIn(): void {
    const currentZoom = this.zoomSignal();
    const newZoom = Math.min(currentZoom * ZOOM_CONFIG.STEP, ZOOM_CONFIG.MAX);
    this.zoomSignal.set(newZoom);
  }

  zoomOut(): void {
    const currentZoom = this.zoomSignal();
    const newZoom = Math.max(currentZoom / ZOOM_CONFIG.STEP, ZOOM_CONFIG.MIN);
    this.zoomSignal.set(newZoom);
  }

  resetZoom(): void {
    this.zoomSignal.set(ZOOM_CONFIG.DEFAULT);
    this.panSignal.set({
      x: ZOOM_CONFIG.PAN.DEFAULT_X,
      y: ZOOM_CONFIG.PAN.DEFAULT_Y,
    });
  }

  setZoomLevel(level: keyof typeof ZOOM_CONFIG.PRECISION_STEPS | number): void {
    if (typeof level === 'number') {
      this.updateZoom(level);
    } else {
      const zoomLevel =
        +ZOOM_CONFIG.PRECISION_STEPS[level] || ZOOM_CONFIG.DEFAULT;
      if (zoomLevel) {
        this.updateZoom(zoomLevel);
      }
    }
  }

  openZoomModal(): void {
    console.log('Opening zoom modal');
    this.modalOpenSignal.set(true);
  }

  closeZoomModal(): void {
    console.log('Closing zoom modal');
    this.modalOpenSignal.set(false);
  }

  downloadCanvas(): void {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const image = this.canvasImageSignal();

    if (image) {
      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      if (this.highlightSignal()) {
        this.drawHighlightsOnCanvas(ctx);
      }

      // Create download link
      const link = document.createElement('a');
      link.download = SAVED_CANVAS_NAME;
      link.href = canvas.toDataURL();
      link.click();
    }
  }

  updateDeadPixelsData(data: {
    deadPixels: DeadPixel[];
    imageData: ImageData;
  }): void {
    this.deadPixelsDataSignal.set(data);
  }

  getCurrentDeadPixels() {
    return this.deadPixelsDataSignal().deadPixels;
  }

  private drawHighlightsOnCanvas(ctx: CanvasRenderingContext2D): void {
    const deadPixels = this.getCurrentDeadPixels();

    deadPixels.forEach((pixel) => {
      const colors = PIXEL_DETECTION.HIGHLIGHT_COLORS;
      let color: number[];

      switch (pixel.type) {
        case PixelType.DEAD:
          color = colors.DEAD;
          break;
        case PixelType.HOT:
          color = colors.HOT;
          break;
        case PixelType.STUCK:
          color = colors.STUCK;
          break;
        default:
          color = colors.DEAD;
      }

      ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.8)`;

      const highlightSize = 3;
      ctx.fillRect(
        pixel.x - highlightSize / 2,
        pixel.y - highlightSize / 2,
        highlightSize,
        highlightSize
      );
    });
  }
}
