import { Component, HostBinding } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  EyeIconComponent,
  EyeOffIconComponent,
  DownloadIconComponent,
  ZoomInIconComponent,
} from '../../../shared/icons';
import { DeadPixelsCanvasService } from '../services/canvas.service';

@Component({
  selector: 'dead-pixels-buttons',
  standalone: true,
  imports: [
    CommonModule,
    EyeIconComponent,
    EyeOffIconComponent,
    DownloadIconComponent,
    ZoomInIconComponent,
  ],
  templateUrl: './utils-buttons.component.html',
  styles: [],
})
export class DeadPixelsUtilsButtonsComponent {
  constructor(private canvasService: DeadPixelsCanvasService) {}

  @HostBinding('style.display')
  get display() {
    return this.canvasService.canvasImage() ? 'block' : 'none';
  }

  @HostBinding('style.height')
  get height() {
    return this.canvasService.canvasImage() ? 'auto' : '0';
  }

  get showHighlight() {
    return this.canvasService.highlight;
  }

  toggleHighlight(): void {
    this.canvasService.toggleHighlight();
  }

  downloadCanvas(): void {
    this.canvasService.downloadCanvas();
  }

  openZoomModal(): void {
    this.canvasService.openZoomModal();
  }
}
