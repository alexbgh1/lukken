import { Routes } from '@angular/router';
import { ThreeDNodesComponent } from './pages/three-d-nodes/three-d-nodes.component';
import { DeadPixelsComponent } from './pages/dead-pixels/dead-pixels.component';

export const routes: Routes = [
  {
    path: '3d-nodes',
    component: ThreeDNodesComponent,
  },
  {
    path: 'dead-pixels',
    component: DeadPixelsComponent,
  },
];
