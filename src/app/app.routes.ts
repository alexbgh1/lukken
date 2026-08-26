import { Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { NotFoundComponent } from './pages/not-found/not-found.component';

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
    path: 'pixel-sort',
    loadComponent: () =>
      import('./pages/pixel-sort/pixel-sort.component').then(
        (module) => module.PixelSortComponent
      ),
  },
  {
    path: 'halftone',
    loadComponent: () =>
      import('./pages/halftone/halftone.component').then(
        (module) => module.HalftoneComponent
      ),
  },
  {
    path: 'glass',
    loadComponent: () =>
      import('./pages/glass/glass.component').then(
        (module) => module.GlassComponent
      ),
  },
  {
    path: 'layouts',
    loadComponent: () =>
      import('./pages/layouts/layouts.component').then(
        (module) => module.LayoutsComponent
      ),
  },
  {
    // Eager, unlike the tools: this is what a broken link lands on, and a
    // chunk that fails to load would leave nothing at all on screen.
    path: '**',
    component: NotFoundComponent,
  },
];
