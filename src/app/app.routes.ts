import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';

export const routes: Routes = [
  {
    path: '',
    component: LandingComponent,
  },
  {
    path: '3d-nodes',
    loadComponent: () =>
      import('./pages/three-d-nodes/three-d-nodes.component').then(
        (module) => module.ThreeDNodesComponent
      ),
  },
  {
    path: 'dead-pixels',
    loadComponent: () =>
      import('./pages/dead-pixels/dead-pixels.component').then(
        (module) => module.DeadPixelsComponent
      ),
  },
  {
    path: 'pixel-sort',
    loadComponent: () =>
      import('./pages/pixel-sort/pixel-sort.component').then(
        (module) => module.PixelSortComponent
      ),
  },
];
