import { Component } from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { FiltersComponent } from './components/filters.component';
import { CanvasComponent } from './components/canvas.component';

@Component({
  imports: [MainLayoutComponent, FiltersComponent, CanvasComponent],
  selector: 'app-three-d-nodes',
  templateUrl: './three-d-nodes.component.html',
})
export class ThreeDNodesComponent {}
