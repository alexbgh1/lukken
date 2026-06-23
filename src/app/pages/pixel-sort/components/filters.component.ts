import { Component, ViewChild, ElementRef, effect, ChangeDetectionStrategy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { PixelSortFiltersService } from '../services/filters.service';
import { PixelSortCanvasService } from '../services/canvas.service';
import {
  COLORS,
  PIXEL_SORT_CONFIG,
  PIXEL_SORT_MODES,
} from '../constants/pixel-sort.constants';

@Component({
  selector: 'pixel-sort-filters',
  imports: [FormsModule],
  templateUrl: './filters.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class PixelSortFiltersComponent {
  @ViewChild('histogramCanvas') histogramCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('angleCanvas') angleCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly CONFIG = PIXEL_SORT_CONFIG;
  readonly MODES = PIXEL_SORT_MODES;

  showControls = true;
  controlsHover = false;

  constructor(
    public filtersService: PixelSortFiltersService,
    public canvasService: PixelSortCanvasService
  ) {
    /* Redarw: if filter changes */
    effect(() => {
      // Calling the service will update the filters
      this.filtersService.filters();
      setTimeout(() => {
        this.drawHistogram();
        this.drawAngleCircle();
      });
    });

    /* Redraw: Histogram */
    effect(() => {
      this.canvasService.histogramData();
      setTimeout(() => this.drawHistogram());
    });
  }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;

      img.onload = () => {
        this.canvasService.setOriginalImage(img);
      };
    };

    reader.readAsDataURL(file);
  }

  processImage(): void {
    this.canvasService.processImage();
  }

  resetImage(): void {
    this.canvasService.resetToOriginal();
  }

  onThresholdChange(value: number): void {
    this.filtersService.setThreshold(value);
  }

  onAngleChange(value: number): void {
    this.filtersService.setAngle(value);
  }

  onModeChange(mode: string): void {
    this.filtersService.setMode(mode as any);
    this.canvasService.generateHistogram();
  }

  setAngle(angle: number): void {
    this.filtersService.setAngle(angle);
  }

  toggleInvert(): void {
    this.filtersService.toggleInvert();
  }

  toggleStackOutput(): void {
    this.filtersService.toggleStackOutput();
  }

  toggleControls(): void {
    this.showControls = !this.showControls;
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
        ctx.fillStyle = COLORS.ACCENT_PINK;
      } else {
        ctx.fillStyle = COLORS.MUTED_GRAY;
      }
      ctx.fillRect(
        i,
        this.CONFIG.CANVAS.HISTOGRAM_HEIGHT,
        1,
        -histogramData[i] * scale
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

    // Draw outer circle
    ctx.strokeStyle = COLORS.MUTED_GRAY;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw angle line
    ctx.strokeStyle = COLORS.ACCENT_PINK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + lineLength * Math.cos(angleRad),
      centerY + lineLength * Math.sin(angleRad)
    );
    ctx.stroke();

    // Draw center dot
    ctx.fillStyle = COLORS.ACCENT_PINK;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
    ctx.fill();

    // Draw reference line (0 degrees)
    ctx.strokeStyle = COLORS.MUTED_GRAY;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + lineLength, centerY);
    ctx.stroke();

    // Draw angle text - centrado horizontalmente
    ctx.fillStyle = COLORS.MUTED_GRAY;
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${filters.angle}°`, centerX, 20);
  }
}
