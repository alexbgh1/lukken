import { Injectable, signal } from '@angular/core';
import {
  PixelSortFilters,
  DEFAULT_FILTERS,
} from '../constants/pixel-sort.constants';

@Injectable({
  providedIn: 'root',
})
export class PixelSortFiltersService {
  private _filters = signal<PixelSortFilters>({ ...DEFAULT_FILTERS });

  readonly filters = this._filters.asReadonly();

  updateFilters(partialFilters: Partial<PixelSortFilters>): void {
    this._filters.update((current) => ({
      ...current,
      ...partialFilters,
    }));
  }

  resetFilters(): void {
    this._filters.set({ ...DEFAULT_FILTERS });
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
}
