import {
  Component,
  effect,
  signal,
  ViewChild,
  AfterViewInit,
  ChangeDetectionStrategy,
} from '@angular/core';

import {
  ZoomInIconComponent,
  ZoomOutIconComponent,
  MoveIconComponent,
  XIconComponent,
} from '@shared/icons';
import { DeadPixelsCanvasService } from '../services/canvas.service';
import { DeadPixelsCanvasComponent } from './canvas.component';
import { DeadPixel, PixelType } from '@interfaces/dead-pixels.interface';
import { PixelLegendComponent } from './pixel-legend.component';

@Component({
  selector: 'dead-pixels-modal',
  imports: [
    ZoomInIconComponent,
    ZoomOutIconComponent,
    MoveIconComponent,
    XIconComponent,
    DeadPixelsCanvasComponent,
    PixelLegendComponent,
  ],
  templateUrl: './modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [],
})
export class DeadPixelsModalComponent {
  @ViewChild(DeadPixelsCanvasComponent)
  canvasComponent!: DeadPixelsCanvasComponent;

  PixelType = PixelType;

  isOpen = signal(false);
  modalHighlight = signal(true);
  zoomLevel = signal(100);
  isDragging = signal(false);
  dragStart = signal({ x: 0, y: 0 });
  panOffset = signal({ x: 0, y: 0 });

  deadPixels: DeadPixel[] = [];
  currentImage: HTMLImageElement | null = null;
  currentSensitivity = 30;

  constructor(private canvasService: DeadPixelsCanvasService) {
    effect(() => {
      this.isOpen.set(this.canvasService.isModalOpen());
    });

    // Get current image from service
    effect(() => {
      const image = this.canvasService.canvasImage();
      this.currentImage = image;
      console.log('Modal received image:', image);
    });

    // Get current sensitivity from filters
    effect(() => {
      const filters = this.canvasService.filtersService.currentFilters();
      if (filters) {
        this.currentSensitivity = filters.sensitivity;
      }
    });

    // Sync highlight state
    effect(() => {
      this.modalHighlight.set(this.canvasService.modalHighlight());
      if (this.canvasComponent) {
        setTimeout(() => {
          this.canvasComponent.toggleHighlights(this.modalHighlight());
        }, 0);
      }
    });

    // Sync zoom and pan
    effect(() => {
      this.zoomLevel.set(this.canvasService.zoom());
      this.panOffset.set(this.canvasService.pan());
    });

    // Sync dead pixels data
    effect(() => {
      const data = this.canvasService.deadPixelsData();
      this.deadPixels = data.deadPixels;
    });
  }

  onImageProcessed(data: {
    deadPixels: DeadPixel[];
    imageData: ImageData;
  }): void {
    this.deadPixels = data.deadPixels;
    console.log('Modal processed image data:', data);
  }

  get canvasTransform(): string {
    const pan = this.panOffset();
    const zoom = this.zoomLevel() / 100;
    return `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  }

  closeModal(): void {
    console.log('Closing modal');
    this.canvasService.closeZoomModal();
  }

  toggleModalHighlight(): void {
    console.log('Toggling highlight');
    this.modalHighlight.update((value) => !value);
    this.canvasService.updateModalHighlight(this.modalHighlight());
  }

  zoomIn(): void {
    const newLevel = Math.min(this.zoomLevel() * 1.2, 500);
    this.zoomLevel.set(newLevel);
    this.canvasService.updateZoom(newLevel);
    console.log('Zoom in to:', newLevel);
  }

  zoomOut(): void {
    const newLevel = Math.max(this.zoomLevel() / 1.2, 50);
    this.zoomLevel.set(newLevel);
    this.canvasService.updateZoom(newLevel);
    console.log('Zoom out to:', newLevel);
  }

  resetZoom(): void {
    console.log('Resetting zoom');
    this.zoomLevel.set(100);
    this.panOffset.set({ x: 0, y: 0 });
    this.canvasService.resetZoom();
  }

  startDrag(event: MouseEvent): void {
    if (event.button !== 0) return;

    this.isDragging.set(true);
    this.dragStart.set({ x: event.clientX, y: event.clientY });
    event.preventDefault();
    event.stopPropagation();
  }

  onDrag(event: MouseEvent): void {
    if (!this.isDragging()) return;

    const dx = event.clientX - this.dragStart().x;
    const dy = event.clientY - this.dragStart().y;

    const currentPan = this.panOffset();
    const newOffset = {
      x: currentPan.x + dx,
      y: currentPan.y + dy,
    };

    this.panOffset.set(newOffset);
    this.dragStart.set({ x: event.clientX, y: event.clientY });
    this.canvasService.updatePan(newOffset);

    event.preventDefault();
  }

  endDrag(): void {
    this.isDragging.set(false);
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    event.stopPropagation();

    const container = event.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const oldZoom = this.zoomLevel();
    const newZoom = Math.min(Math.max(oldZoom * delta, 50), 500);

    if (newZoom !== oldZoom) {
      const zoomRatio = newZoom / oldZoom;
      const currentPan = this.panOffset();

      const newPanX = mouseX - (mouseX - currentPan.x) * zoomRatio;
      const newPanY = mouseY - (mouseY - currentPan.y) * zoomRatio;

      this.zoomLevel.set(newZoom);
      this.panOffset.set({ x: newPanX, y: newPanY });

      this.canvasService.updateZoom(newZoom);
      this.canvasService.updatePan({ x: newPanX, y: newPanY });
    }
  }

  get deadPixelsCount(): number {
    return this.deadPixels.length;
  }

  get deadPixelsByType() {
    return {
      dead: this.deadPixels.filter((p) => p.type === PixelType.DEAD).length,
      hot: this.deadPixels.filter((p) => p.type === PixelType.HOT).length,
      stuck: this.deadPixels.filter((p) => p.type === PixelType.STUCK).length,
    };
  }
}
