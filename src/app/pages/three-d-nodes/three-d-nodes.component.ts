import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  signal,
  effect,
} from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { ToolShellComponent } from '@shared/components/tool-shell/tool-shell.component';
import { Three3DFiltersComponent } from './components/filters.component';
import { Three3DCanvasComponent } from './components/canvas.component';
import { DownloadIconComponent } from '@shared/icons';
import { FiltersDataService } from './services/filters-data.service';
import { ProcessingIndicatorComponent } from '@shared/components/processing-indicator/processing-indicator.component';

@Component({
  imports: [
    MainLayoutComponent,
    ToolShellComponent,
    Three3DFiltersComponent,
    Three3DCanvasComponent,
    DownloadIconComponent,
    ProcessingIndicatorComponent,
  ],
  selector: 'app-three-d-nodes',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './three-d-nodes.component.html',
})
export class ThreeDNodesComponent {
  @ViewChild(Three3DCanvasComponent) canvasComponent!: Three3DCanvasComponent;

  canvasImage = signal(false);

  constructor(public filtersData: FiltersDataService) {
    effect(() => {
      this.canvasImage.set(!!filtersData.currentFilters()?.image);
    });
  }

  downloadCanvas(): void {
    this.canvasComponent?.downloadCanvas();
  }

  /** Squares the scene back up, so a shot can be framed deliberately. */
  resetView(): void {
    this.canvasComponent?.resetView();
  }
}
