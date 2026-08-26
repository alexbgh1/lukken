import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { ToolShellComponent } from '@shared/components/tool-shell/tool-shell.component';
import { DownloadIconComponent } from '@shared/icons';
import { ZoomControlComponent } from '@shared/components/zoom-control/zoom-control.component';
import { ProcessingIndicatorComponent } from '@shared/components/processing-indicator/processing-indicator.component';
import { ZoomLevel, formatScale } from '@shared/utils/zoom';
import { HalftoneFiltersComponent } from './components/filters.component';
import { HalftoneCanvasComponent } from './components/canvas.component';
import { HalftoneCanvasService } from './services/canvas.service';
import { HalftoneFiltersService } from './services/filters.service';

@Component({
  selector: 'app-halftone',
  imports: [
    MainLayoutComponent,
    ToolShellComponent,
    HalftoneFiltersComponent,
    HalftoneCanvasComponent,
    DownloadIconComponent,
    ZoomControlComponent,
    ProcessingIndicatorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './halftone.component.html',
})
export class HalftoneComponent {
  constructor(
    public canvasService: HalftoneCanvasService,
    public filtersService: HalftoneFiltersService,
  ) {}

  /** Working resolution, which is what the preview is screened against. */
  imageLabel(): string {
    const size = this.canvasService.imageSize();
    return size ? size.width + '×' + size.height : '';
  }

  /** Original file dimensions, shown only when the cap actually reduced them. */
  sourceLabel(): string {
    const size = this.canvasService.sourceSize();
    return size ? size.width + '×' + size.height : '';
  }

  /** Resolution the download re-screens at, which is not the preview's. */
  exportLabel(): string {
    const size = this.canvasService.exportSize();
    return size ? size.width + '×' + size.height : '';
  }

  /**
   * Resolution line for the toolbar, showing the downscale only when the cap
   * actually applied. Built here because assembling it from template blocks
   * leaves whitespace around each branch, which lands in front of the comma
   * that follows.
   */
  sizeLabel(): string {
    const working = this.imageLabel();
    return this.canvasService.isDownscaled()
      ? this.sourceLabel() + ' to ' + working
      : working;
  }

  /** The scale currently on screen, measured from the live layout. */
  zoomLabel(): string {
    return formatScale(this.filtersService.effectiveScale());
  }

  dotsLabel(): string {
    const dots = this.canvasService.dotCount();
    return dots === null ? '' : dots.toLocaleString();
  }

  setZoom(zoom: ZoomLevel): void {
    this.filtersService.setZoom(zoom);
  }

  /**
   * Turning live preview back on catches the preview up straight away, so the
   * toggle never leaves the canvas showing something the controls disagree
   * with. Turning it off changes nothing on screen.
   */
  toggleLive(): void {
    const live = !this.filtersService.liveChanges();
    this.filtersService.setLiveChanges(live);
    if (live && this.canvasService.hasPendingChanges()) {
      this.canvasService.rebuild();
    }
  }

  /** Applies the pending settings now, skipping the debounce. */
  applyNow(): void {
    this.canvasService.rebuild();
  }

  /**
   * The export always re-screens from the current settings, so with live
   * preview off it would otherwise produce a file that does not match the
   * stale canvas. Catching the preview up first keeps the two in agreement.
   */
  downloadCanvas(): void {
    if (this.canvasService.hasPendingChanges()) {
      this.canvasService.rebuild();
    }
    void this.canvasService.downloadImage();
  }
}
