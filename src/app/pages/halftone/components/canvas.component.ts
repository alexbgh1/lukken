import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  viewChild,
} from '@angular/core';
import { CanvasStageComponent } from '@shared/components/canvas-stage/canvas-stage.component';
import { zoomStyles } from '@shared/utils/zoom';
import { HalftoneCanvasService } from '../services/canvas.service';
import { HalftoneFiltersService } from '../services/filters.service';

@Component({
  selector: 'halftone-canvas',
  imports: [CanvasStageComponent],
  styles: [
    `
      /* Passes the height down from the page frame to the stage. The chain
         only resolves if every link declares one. */
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The canvas keeps its full pixel data; only the CSS box changes, so
         nothing here affects the exported file. -->
    <canvas-stage (resized)="reportScale()">
      <canvas
        #stage
        class="block"
        [style.width]="styles().width"
        [style.height]="styles().height"
        [style.maxWidth]="styles().maxWidth"
        [style.maxHeight]="styles().maxHeight"
      ></canvas>
    </canvas-stage>
  `,
})
export class HalftoneCanvasComponent {
  private stage = viewChild<ElementRef<HTMLCanvasElement>>('stage');

  constructor(
    private canvasService: HalftoneCanvasService,
    private filtersService: HalftoneFiltersService,
  ) {
    // Repaints when the plates are rebuilt and when the colours change.
    // Reading these signals is what registers the dependency.
    effect(() => {
      this.canvasService.layerVersion();
      const f = this.filtersService.filters();
      void f.inkColor;
      void f.paperColor;
      void f.mode;
      this.filtersService.zoom();
      this.redraw();
      // Layout settles after this tick; measure then.
      queueMicrotask(() => this.reportScale());
    });
  }

  /**
   * CSS box for the current zoom level. Never affects the pixel data.
   *
   * Measured against the SOURCE image, not the working canvas. The working
   * canvas is capped, so sizing against it made 100% mean a different
   * on-screen size here than in a tool without a cap, for the very same photo.
   * Zoom describes the picture, not the buffer it happens to be held in.
   */
  styles = computed(() => {
    const size =
      this.canvasService.sourceSize() ?? this.canvasService.imageSize();
    return zoomStyles(
      this.filtersService.zoom(),
      size?.width ?? null,
      size?.height ?? null,
    );
  });

  /** Reports the scale actually on screen, against the source dimensions. */
  reportScale(): void {
    const canvas = this.stage()?.nativeElement;
    if (!canvas || !canvas.width) return;
    const source = this.canvasService.sourceSize();
    const reference = source?.width ?? canvas.width;
    const shown = canvas.getBoundingClientRect().width;
    if (shown > 0) {
      this.filtersService.setEffectiveScale(shown / reference);
    }
  }

  private redraw(): void {
    const canvas = this.stage()?.nativeElement;
    if (!canvas) return;
    this.canvasService.paint(canvas);
  }
}
