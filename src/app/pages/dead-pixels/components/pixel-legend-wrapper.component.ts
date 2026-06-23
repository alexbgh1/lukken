import { Component, effect, signal, ChangeDetectionStrategy } from '@angular/core';

import { DeadPixelsCanvasService } from '../services/canvas.service';
import { PixelLegendComponent } from './pixel-legend.component';
import {
  DeadPixel,
  PixelType,
} from '@interfaces/dead-pixels.interface';

@Component({
  selector: 'dead-pixels-legend-wrapper',
  standalone: true,
  imports: [PixelLegendComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (hasPixelData()) {
    <div class="flex gap-4 items-center">
      <pixel-legend
        [pixelType]="PixelType.DEAD"
        [pixelCount]="deadPixelsByType().dead"
        pixelLegendText="Dead pixels"
      ></pixel-legend>

      <pixel-legend
        [pixelType]="PixelType.HOT"
        [pixelCount]="deadPixelsByType().hot"
        pixelLegendText="Hot pixels"
      ></pixel-legend>

      <pixel-legend
        [pixelType]="PixelType.STUCK"
        [pixelCount]="deadPixelsByType().stuck"
        pixelLegendText="Stuck pixels"
      ></pixel-legend>
    </div>
    } @else {
    <div class="text-text-secondary text-sm">
      Upload an image to see pixel analysis
    </div>
    }
  `,
})
export class DeadPixelsLegendWrapperComponent {
  PixelType = PixelType;

  private deadPixels = signal<DeadPixel[]>([]);

  deadPixelsByType = signal({
    dead: 0,
    hot: 0,
    stuck: 0,
  });

  constructor(private canvasService: DeadPixelsCanvasService) {
    effect(() => {
      const data = this.canvasService.deadPixelsData();
      const pixels = data.deadPixels;

      this.deadPixels.set(pixels);

      this.deadPixelsByType.set({
        dead: pixels.filter((p) => p.type === PixelType.DEAD).length,
        hot: pixels.filter((p) => p.type === PixelType.HOT).length,
        stuck: pixels.filter((p) => p.type === PixelType.STUCK).length,
      });
    });
  }

  hasPixelData(): boolean {
    return this.deadPixels().length > 0;
  }
}
