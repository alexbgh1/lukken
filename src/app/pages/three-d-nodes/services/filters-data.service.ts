import { Injectable, signal } from '@angular/core';
import { CanvasFilters } from '../../../interfaces/filters.interface';

@Injectable({
  providedIn: 'root',
})
export class FiltersDataService {
  private filtersSignal = signal<CanvasFilters | null>(null);
  currentFilters = this.filtersSignal.asReadonly();

  updateFilters(filters: CanvasFilters): void {
    this.filtersSignal.set(filters);
  }
}
