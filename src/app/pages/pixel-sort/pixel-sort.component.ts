import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { PixelSortFiltersComponent } from './components/filters.component';
import { PixelSortCanvasComponent } from './components/canvas.component';

@Component({
  imports: [
    MainLayoutComponent,
    PixelSortFiltersComponent,
    PixelSortCanvasComponent,
  ],
  selector: 'pixel-sort',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pixel-sort.component.html',
})
export class PixelSortComponent {}
