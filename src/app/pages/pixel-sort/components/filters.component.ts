import {
  Component,
  ViewChild,
  ElementRef,
  effect,
  ChangeDetectionStrategy,
} from '@angular/core';

import { PixelSortFiltersService } from '../services/filters.service';
import { PixelSortCanvasService } from '../services/canvas.service';
import { PixelSortMaskService } from '../services/mask.service';
import {
  COLORS,
  PIXEL_SORT_CONFIG,
  PIXEL_SORT_MODES,
  PixelSortMode,
} from '../constants/pixel-sort.constants';
import { ImageUploadComponent } from '@shared/components/image-upload/image-upload.component';

@Component({
  selector: 'pixel-sort-filters',
  imports: [ImageUploadComponent],
  templateUrl: './filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class PixelSortFiltersComponent {
  @ViewChild('histogramCanvas') histogramCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('angleCanvas') angleCanvas!: ElementRef<HTMLCanvasElement>;

  readonly CONFIG = PIXEL_SORT_CONFIG;
  readonly MODES = PIXEL_SORT_MODES;

  constructor(
    public filtersService: PixelSortFiltersService,
    public canvasService: PixelSortCanvasService,
    public maskService: PixelSortMaskService,
  ) {
    effect(() => {
      this.filtersService.filters();
      setTimeout(() => {
        this.drawHistogram();
        this.drawAngleCircle();
      });
    });

    effect(() => {
      this.canvasService.histogramData();
      setTimeout(() => this.drawHistogram());
    });

    effect(() => {
      this.canvasService.originalImage();
      setTimeout(() => {
        this.drawHistogram();
        this.drawAngleCircle();
      });
    });
  }

  onImageSelected(file: File): void {
    this.canvasService.loadFile(file);
  }

  onImageCleared(): void {
    this.canvasService.clearImage();
  }

  processImage(): void {
    this.canvasService.processImage();
  }

  onThresholdChange(value: number): void {
    this.filtersService.setThreshold(value);
  }

  onAngleChange(value: number): void {
    this.filtersService.setAngle(value);
  }

  onModeChange(mode: string): void {
    this.filtersService.setMode(mode as PixelSortMode);
    this.canvasService.generateHistogram();
  }

  setAngle(angle: number): void {
    this.filtersService.setAngle(angle);
  }

  setMode(mode: PixelSortMode): void {
    this.filtersService.setMode(mode);
  }

  resetThreshold(): void {
    this.filtersService.setThreshold(this.CONFIG.THRESHOLD.DEFAULT);
  }

  resetAngle(): void {
    this.filtersService.setAngle(this.CONFIG.ANGLE.DEFAULT);
  }

  toggleInvert(): void {
    this.filtersService.toggleInvert();
  }

  toggleStackOutput(): void {
    this.filtersService.toggleStackOutput();
  }

  toggleCircularSort(): void {
    this.filtersService.toggleCircularSort();
  }

  resetPivot(): void {
    this.filtersService.resetPivot();
  }

  onBrushSizeChange(value: number): void {
    this.maskService.setBrushSize(value);
  }

  onBrushColorChange(value: string): void {
    this.maskService.setBrushColor(value);
  }

  onBrushOpacityChange(value: number): void {
    this.maskService.setBrushOpacity(value);
  }

  onBrushHoleChange(value: number): void {
    // Slider is 0-100; store as fraction 0-1.
    this.maskService.setBrushHole(value / 100);
  }

  setBrushShape(shape: 'circle' | 'ring'): void {
    this.maskService.setBrushShape(shape);
  }

  toggleMask(): void {
    this.maskService.toggleMask();
  }

  clearMask(): void {
    this.maskService.clearMask();
  }

  private drawHistogram(): void {
    if (!this.histogramCanvas) return;

    const ctx = this.histogramCanvas.nativeElement.getContext('2d')!;
    const histogramData = this.canvasService.histogramData();
    const filters = this.filtersService.filters();

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const max = Math.max(...histogramData);
    if (max === 0) return;

    const scale = this.CONFIG.CANVAS.HISTOGRAM_HEIGHT / max;

    for (let i = 0; i < histogramData.length; i++) {
      if (
        (filters.invert && i < filters.threshold) ||
        (!filters.invert && i >= filters.threshold)
      ) {
        ctx.fillStyle = COLORS.ACCENT;
      } else {
        ctx.fillStyle = COLORS.MUTED;
      }
      ctx.fillRect(
        i,
        this.CONFIG.CANVAS.HISTOGRAM_HEIGHT,
        1,
        -histogramData[i] * scale,
      );
    }
  }

  private drawAngleCircle(): void {
    if (!this.angleCanvas) return;

    const ctx = this.angleCanvas.nativeElement.getContext('2d')!;
    const filters = this.filtersService.filters();
    const angleRad = (filters.angle * Math.PI) / 180;

    const centerX = this.CONFIG.CANVAS.ANGLE_CIRCLE_SIZE / 2;
    const centerY = this.CONFIG.CANVAS.ANGLE_CIRCLE_SIZE / 2;
    const radius = centerX - 10;
    const lineLength = radius - 5;

    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    ctx.strokeStyle = COLORS.MUTED;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.strokeStyle = COLORS.ACCENT;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + lineLength * Math.cos(angleRad),
      centerY + lineLength * Math.sin(angleRad),
    );
    ctx.stroke();

    ctx.fillStyle = COLORS.ACCENT;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
    ctx.fill();

    ctx.strokeStyle = COLORS.MUTED;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + lineLength, centerY);
    ctx.stroke();

    ctx.fillStyle = COLORS.MUTED;
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${filters.angle}°`, centerX, 20);
  }
}
