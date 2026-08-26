import {
  ChangeDetectionStrategy,
  Component,
  effect,
  untracked,
} from '@angular/core';
import { ImageUploadComponent } from '@shared/components/image-upload/image-upload.component';
import {
  HALFTONE_CONFIG,
  HALFTONE_PRESETS,
  HALFTONE_SHAPES,
  HalftoneFilters,
  HalftoneMode,
  HalftoneShape,
} from '../constants/halftone.constants';
import {
  HalftoneFiltersService,
  HalftoneNumericKey,
} from '../services/filters.service';
import { HalftoneCanvasService } from '../services/canvas.service';

@Component({
  selector: 'halftone-filters',
  imports: [ImageUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filters.component.html',
})
export class HalftoneFiltersComponent {
  CONFIG = HALFTONE_CONFIG;
  FILE_CONFIG = HALFTONE_CONFIG.FILE_CONFIG;
  SHAPES = HALFTONE_SHAPES;
  PRESETS = HALFTONE_PRESETS;

  constructor(
    public filtersService: HalftoneFiltersService,
    public canvasService: HalftoneCanvasService,
  ) {
    // Only the screening inputs are tracked here. Ink and paper changes
    // repaint via the canvas component without re-running the screen.
    //
    // `liveChanges` is read inside untracked deliberately: toggling it must
    // not by itself trigger a pass, only decide whether the next edit does.
    // Turning it back on is handled explicitly by the toolbar.
    effect(() => {
      this.filtersService.heavyKey();
      untracked(() => {
        if (!this.canvasService.hasImage()) return;
        if (!this.filtersService.liveChanges()) return;
        this.canvasService.scheduleRebuild();
      });
    });
  }

  get filters(): HalftoneFilters {
    return this.filtersService.filters();
  }

  /**
   * The four process plates, as rows for the angle controls.
   *
   * Built here rather than as a literal in the template because an inline
   * array widens `key` to `string`, which loses the union the numeric
   * setters are typed against.
   */
  get plates(): Array<{
    key: HalftoneNumericKey;
    label: string;
    value: number;
  }> {
    const f = this.filters;
    return [
      { key: 'angleC', label: 'Cyan', value: f.angleC },
      { key: 'angleM', label: 'Magenta', value: f.angleM },
      { key: 'angleY', label: 'Yellow', value: f.angleY },
      { key: 'angleK', label: 'Black', value: f.angleK },
    ];
  }

  // Image.

  onImageSelected(file: File): void {
    this.canvasService.loadFile(file);
  }

  onImageCleared(): void {
    this.canvasService.clearImage();
  }

  // Mode and shape.

  setMode(mode: HalftoneMode): void {
    this.filtersService.setMode(mode);
  }

  isMode(mode: HalftoneMode): boolean {
    return this.filters.mode === mode;
  }

  setShape(shape: HalftoneShape): void {
    this.filtersService.setShape(shape);
  }

  isShape(shape: HalftoneShape): boolean {
    return this.filters.shape === shape;
  }

  toggleNegative(): void {
    this.filtersService.toggleNegative();
  }

  // Numeric controls.

  setValue(key: HalftoneNumericKey, value: string | number): void {
    this.filtersService.setValue(key, Number(value));
  }

  /**
   * Double-click restores the default, matching 3D Nodes and Fractal Glass.
   * Paired with `isModified` it also drives the `slider-modified` thumb.
   */
  resetValue(key: HalftoneNumericKey): void {
    this.filtersService.resetValue(key);
  }

  isModified(key: HalftoneNumericKey): boolean {
    return this.filtersService.isModified(key);
  }

  resetProcessAngles(): void {
    this.filtersService.resetProcessAngles();
  }

  // Ink and paper.

  setInk(color: string): void {
    this.filtersService.setInk(color);
  }

  setPaper(color: string): void {
    this.filtersService.setPaper(color);
  }

  applyPreset(ink: string, paper: string): void {
    this.filtersService.applyPreset(ink, paper);
  }

  isPreset(ink: string, paper: string): boolean {
    return this.filters.inkColor === ink && this.filters.paperColor === paper;
  }

  swapInkAndPaper(): void {
    this.filtersService.swapInkAndPaper();
  }
}
