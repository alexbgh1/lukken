// dead-pixels.component.ts
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { DeadPixelsFiltersComponent } from './components/filters.component';
import { DeadPixelsCanvasComponent } from './components/canvas.component';
import { DeadPixelsModalComponent } from './components/modal.component';
import { DeadPixelsUtilsButtonsComponent } from './components/utils-buttons.component';
import { DeadPixelsLegendWrapperComponent } from './components/pixel-legend-wrapper.component';
import { PixelLegendComponent } from './components/pixel-legend.component';
import { PixelType } from '../../interfaces/dead-pixels.interface';

@Component({
  selector: 'app-dead-pixels',
  imports: [
    MainLayoutComponent,
    DeadPixelsFiltersComponent,
    DeadPixelsCanvasComponent,
    DeadPixelsModalComponent,
    DeadPixelsUtilsButtonsComponent,
    DeadPixelsLegendWrapperComponent,
    PixelLegendComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './dead-pixels.component.html',
})
export class DeadPixelsComponent {
  PixelType = PixelType;
}
