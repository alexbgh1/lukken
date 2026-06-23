import { Component, computed, inject } from '@angular/core';

import { PixelSortCanvasService } from '../services/canvas.service';

@Component({
  selector: 'pixel-sort-canvas',
  imports: [],
  templateUrl: './canvas.component.html',
  standalone: true,
})
export class PixelSortCanvasComponent {
  private canvasService = inject(PixelSortCanvasService);

  imageToShow = computed(() => {
    const processedImage = this.canvasService.processedImage();
    const originalImage = this.canvasService.originalImage();
    return processedImage || originalImage;
  });

  hasImage = computed(() => !!this.imageToShow());
}
