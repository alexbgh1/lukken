import { Component, Input } from '@angular/core';
import {
  PIXEL_LEGENDS,
  PixelType,
} from '../../../interfaces/dead-pixels.interface';

@Component({
  selector: 'pixel-legend',
  standalone: true,
  imports: [],
  template: `
    <div class="flex items-center gap-2">
      @switch (pixelType) { @case (PixelType.DEAD) {
      <span class="inline-block w-3 h-3 bg-red-500 rounded"></span>
      <span>{{ PIXEL_LEGENDS[PixelType.DEAD] }} ({{ pixelCount }})</span>
      } @case (PixelType.HOT) {
      <span class="inline-block w-3 h-3 bg-green-500 rounded"></span>
      <span>{{ PIXEL_LEGENDS[PixelType.HOT] }} ({{ pixelCount }})</span>
      } @case (PixelType.STUCK) {
      <span class="inline-block w-3 h-3 bg-yellow-500 rounded"></span>
      <span>{{ PIXEL_LEGENDS[PixelType.STUCK] }} ({{ pixelCount }})</span>
      } @default {
      <span class="inline-block w-3 h-3 bg-gray-500 rounded"></span>
      <span>{{ PIXEL_LEGENDS[pixelType] }} ({{ pixelCount }})</span>
      } }
    </div>
  `,
})
export class PixelLegendComponent {
  @Input() pixelCount: number = 0;
  @Input() pixelType: PixelType = PixelType.DEAD;
  PIXEL_LEGENDS = PIXEL_LEGENDS;

  PixelType = PixelType;
}
