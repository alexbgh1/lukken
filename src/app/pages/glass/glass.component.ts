import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { ToolShellComponent } from '@shared/components/tool-shell/tool-shell.component';
import {
  DownloadIconComponent,
  EyeIconComponent,
  EyeOffIconComponent,
} from '@shared/icons';
import { GlassFiltersComponent } from './components/filters.component';
import { GlassCanvasComponent } from './components/canvas.component';
import { GlassCanvasService } from './services/canvas.service';
import { GlassFiltersService } from './services/filters.service';
import { ZoomControlComponent } from '@shared/components/zoom-control/zoom-control.component';
import { ProcessingIndicatorComponent } from '@shared/components/processing-indicator/processing-indicator.component';
import { ZoomLevel, formatScale } from '@shared/utils/zoom';

@Component({
  selector: 'app-glass',
  imports: [
    MainLayoutComponent,
    ToolShellComponent,
    GlassFiltersComponent,
    GlassCanvasComponent,
    DownloadIconComponent,
    EyeIconComponent,
    EyeOffIconComponent,
    ZoomControlComponent,
    ProcessingIndicatorComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './glass.component.html',
})
export class GlassComponent {
  constructor(
    public canvasService: GlassCanvasService,
    public filtersService: GlassFiltersService,
  ) {}

  /** Working resolution - what the filter runs on and what gets exported. */
  imageLabel(): string {
    const size = this.canvasService.imageSize();
    return size ? size.width + '×' + size.height : '';
  }

  /** Original file dimensions, shown only when the cap actually reduced them. */
  sourceLabel(): string {
    const size = this.canvasService.sourceSize();
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

  setZoom(zoom: ZoomLevel): void {
    this.filtersService.setZoom(zoom);
  }

  /**
   * Any masked mode paints an editable frame, so the toggle applies to
   * Polygon just as much as to Rectangle.
   */
  isMasked(): boolean {
    return this.filtersService.filters().maskMode !== 'full';
  }

  showMaskOverlay(): boolean {
    return this.filtersService.showMaskOverlay();
  }

  toggleMaskOverlay(): void {
    this.filtersService.toggleMaskOverlay();
  }

  /** Resolution the download re-runs the effect at. */
  exportLabel(): string {
    const size = this.canvasService.exportSize();
    return size ? size.width + '×' + size.height : '';
  }

  downloadCanvas(): void {
    void this.canvasService.downloadImage();
  }
}
