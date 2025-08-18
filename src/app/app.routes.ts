import { Routes } from '@angular/router';
import { ThreeDNodesComponent } from './pages/three-d-nodes/three-d-nodes.component';
import { DeadPixelsComponent } from './pages/dead-pixels/dead-pixels.component';
import { LandingComponent } from './pages/landing/landing.component';
import { PixelSortComponent } from './pages/pixel-sort/pixel-sort.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent,
  },
  {
    path: '3d-nodes',
    component: ThreeDNodesComponent,
  },
  {
    path: 'dead-pixels',
    component: DeadPixelsComponent,
  },
  {
    path: 'pixel-sort',
    component: PixelSortComponent,
  },
];
