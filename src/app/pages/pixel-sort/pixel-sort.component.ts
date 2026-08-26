import {
  Component,
  ChangeDetectionStrategy,
  ViewChild,
  signal,
  effect,
} from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { ToolShellComponent } from '@shared/components/tool-shell/tool-shell.component';
import { PixelSortFiltersComponent } from './components/filters.component';
import { PixelSortCanvasComponent } from './components/canvas.component';
import { DownloadIconComponent } from '@shared/icons';
import { ZoomControlComponent } from '@shared/components/zoom-control/zoom-control.component';
import { ProcessingIndicatorComponent } from '@shared/components/processing-indicator/processing-indicator.component';
import { formatScale } from '@shared/utils/zoom';
import { PixelSortFiltersService } from './services/filters.service';
import { PixelSortCanvasService } from './services/canvas.service';
import { PixelSortMaskService } from './services/mask.service';
import { EyeIconComponent, EyeOffIconComponent } from '@shared/icons';

@Component({
  imports: [
    MainLayoutComponent,
    ToolShellComponent,
    PixelSortFiltersComponent,
    PixelSortCanvasComponent,
    DownloadIconComponent,
    EyeIconComponent,
    EyeOffIconComponent,
    ZoomControlComponent,
    ProcessingIndicatorComponent,
  ],
  selector: 'pixel-sort',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pixel-sort.component.html',
})
export class PixelSortComponent {
  @ViewChild(PixelSortCanvasComponent)
  canvasComponent!: PixelSortCanvasComponent;

  canvasImage = signal(false);
  isProcessing = signal(false);

  constructor(
    public filtersService: PixelSortFiltersService,
    public canvasService: PixelSortCanvasService,
    public maskService: PixelSortMaskService,
  ) {
    effect(() => {
      this.canvasImage.set(!!canvasService.originalImage());
    });
    effect(() => {
      this.isProcessing.set(canvasService.isProcessing());
    });
  }

  /** Native pixel size of what is on screen, not the displayed size. */
  imageLabel(): string {
    const image =
      this.canvasService.processedImage() ?? this.canvasService.originalImage();
    return image ? image.naturalWidth + ' x ' + image.naturalHeight : '';
  }

  zoomLabel(): string {
    return formatScale(this.canvasService.effectiveScale());
  }

  downloadCanvas(): void {
    this.canvasComponent?.downloadCanvas();
  }

  resetImage(): void {
    this.canvasComponent?.resetImage();
  }

  /** Composition guide. A view setting, so it belongs beside the zoom. */
  showThirds(): boolean {
    return this.filtersService.filters().showGrid;
  }

  toggleThirds(): void {
    this.filtersService.updateFilters({
      showGrid: !this.filtersService.filters().showGrid,
    });
  }

  /**
   * Hides the mask overlay without discarding it. After a sort the overlay
   * covers the result it produced, so judging the output means being able to
   * look underneath. The selection itself is untouched.
   */
  maskVisible(): boolean {
    return this.maskService.isOverlayVisible();
  }

  toggleMaskOverlay(): void {
    this.maskService.toggleOverlay();
  }
}
