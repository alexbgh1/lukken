import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import {
  PIXEL_LEGENDS,
  PixelType,
} from '@interfaces/dead-pixels.interface';

@Component({
  selector: 'pixel-legend',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2">
      @switch (pixelType()) {
      <!-- case DEAD -->
      @case (PixelType.DEAD) {
      <span class="inline-block w-3 h-3 bg-red-500 rounded"></span>
      <span
        >{{ PIXEL_LEGENDS[PixelType.DEAD] }}

        <!--  -->
        @if (pixelCount() != null) { ({{ pixelCount() }})}
        <!--  -->
      </span>

      @if(description()) {
      <span> : {{ description() }} </span>

      } }
      <!-- case HOT -->
      @case (PixelType.HOT) {
      <span class="inline-block w-3 h-3 bg-green-500 rounded"></span>
      <span
        >{{ PIXEL_LEGENDS[PixelType.HOT] }}

        <!--  -->
        @if (pixelCount() != null) { ({{ pixelCount() }}) }
        <!--  -->
      </span>
      @if(description()) {<span> : {{ description() }} </span>}}

      <!-- case STUCK -->
      @case (PixelType.STUCK) {
      <span class="inline-block w-3 h-3 bg-yellow-500 rounded"></span>
      <span
        >{{ PIXEL_LEGENDS[PixelType.STUCK] }}

        <!--  -->
        @if (pixelCount() != null) { ({{ pixelCount() }}) }
      </span>
      <!--  -->
      @if(description()) {: {{ description() }} } }

      <!-- case DEFAULT -->
      @default {
      <span class="inline-block w-3 h-3 bg-gray-500 rounded"></span>
      <span
        >{{ PIXEL_LEGENDS[pixelType()] }}
        <!--  -->
        @if (pixelCount() != null) { ({{ pixelCount() }}) }
        <!--  -->
      </span>
      <!--  -->
      @if(description()) {: {{ description() }}} } }
    </div>
  `,
})
export class PixelLegendComponent {
  pixelCount = input<number | null>(null);
  description = input<string>('');
  pixelType = input<PixelType>(PixelType.DEAD);

  /* Constants values */
  PIXEL_LEGENDS = PIXEL_LEGENDS;
  PixelType = PixelType;
}
