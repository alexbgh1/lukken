import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  inject,
  viewChild,
} from '@angular/core';

import { CanvasStageComponent } from '@shared/components/canvas-stage/canvas-stage.component';
import { zoomStylesInStage } from '@shared/utils/zoom';
import { PixelSortCanvasService } from '../services/canvas.service';
import { PixelSortMaskCanvasComponent } from './mask-canvas.component';

@Component({
  selector: 'pixel-sort-canvas',
  imports: [PixelSortMaskCanvasComponent, CanvasStageComponent],
  templateUrl: './canvas.component.html',
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
  standalone: true,
})
export class PixelSortCanvasComponent {
  private canvasService = inject(PixelSortCanvasService);
  private displayed = viewChild<ElementRef<HTMLImageElement>>('displayed');

  imageToShow = computed(() => {
    const processedImage = this.canvasService.processedImage();
    const originalImage = this.canvasService.originalImage();
    return processedImage || originalImage;
  });

  hasImage = computed(() => !!this.imageToShow());

  private stage = viewChild(CanvasStageComponent);

  /**
   * CSS box for the current zoom level. Never affects the pixel data.
   *
   * Computed against the stage's measured box rather than with a percentage,
   * because the hugging wrapper between the frame and the image swallows the
   * percentage. See `zoomStylesInStage`.
   */
  styles = computed(() => {
    const image = this.imageToShow();
    return zoomStylesInStage(
      this.canvasService.zoom(),
      image?.naturalWidth ?? null,
      image?.naturalHeight ?? null,
      this.stage()?.size() ?? null,
    );
  });

  /** Feeds the toolbar readout with the scale actually on screen. */
  reportScale(): void {
    const el = this.displayed()?.nativeElement;
    if (!el || !el.naturalWidth) return;
    const shown = el.getBoundingClientRect().width;
    if (shown > 0) {
      this.canvasService.setEffectiveScale(shown / el.naturalWidth);
    }
  }

  downloadCanvas(): void {
    this.canvasService.downloadImage();
  }

  resetImage(): void {
    this.canvasService.resetToOriginal();
  }
}
