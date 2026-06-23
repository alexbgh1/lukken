import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { Three3dFiltersComponent } from './components/filters.component';
import { Three3DCanvasComponent } from './components/canvas.component';

@Component({
  imports: [
    MainLayoutComponent,
    Three3dFiltersComponent,
    Three3DCanvasComponent,
  ],
  selector: 'app-three-d-nodes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './three-d-nodes.component.html',
})
export class ThreeDNodesComponent {}
