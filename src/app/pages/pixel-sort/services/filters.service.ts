import { Injectable, signal } from '@angular/core';
import {
  PixelSortFilters,
  Pivot,
  DEFAULT_FILTERS,
} from '../constants/pixel-sort.constants';

@Injectable({
  providedIn: 'root',
})
export class PixelSortFiltersService {
  private _filters = signal<PixelSortFilters>({ ...DEFAULT_FILTERS });

  // Pivot for circular sort, in NATIVE image pixel coordinates.
  // `null` means "auto-center" - resolved to {w/2, h/2} at sort time and
  // for UI display. Set explicitly when the user drags the pivot marker.
  private _pivot = signal<Pivot | null>(null);

  readonly filters = this._filters.asReadonly();
  readonly pivot = this._pivot.asReadonly();

  updateFilters(partialFilters: Partial<PixelSortFilters>): void {
    this._filters.update((current) => ({
      ...current,
      ...partialFilters,
    }));
  }

  resetFilters(): void {
    this._filters.set({ ...DEFAULT_FILTERS });
    this._pivot.set(null);
  }

  setThreshold(threshold: number): void {
    this.updateFilters({ threshold });
  }

  setAngle(angle: number): void {
    this.updateFilters({ angle });
  }

  setMode(mode: PixelSortFilters['mode']): void {
    this.updateFilters({ mode });
  }

  toggleInvert(): void {
    this._filters.update((current) => ({
      ...current,
      invert: !current.invert,
    }));
  }

  toggleStackOutput(): void {
    this._filters.update((current) => ({
      ...current,
      stackOutput: !current.stackOutput,
    }));
  }

  toggleCircularSort(): void {
    this._filters.update((current) => ({
      ...current,
      circularSort: !current.circularSort,
    }));
  }

  /**
   * Sets the pivot in native image coordinates.
   * Called from the draggable marker in mask-canvas.component.
   */
  setPivot(x: number, y: number): void {
    this._pivot.set({ x, y });
  }

  /**
   * Resets the pivot to auto-center. The UI marker snaps back to the
   * center of the image.
   */
  resetPivot(): void {
    this._pivot.set(null);
  }
}
