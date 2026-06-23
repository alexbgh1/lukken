import { Injectable, signal } from '@angular/core';
import { CanvasFilters } from '@interfaces/three-d-nodes-filters.interface';

@Injectable({
  providedIn: 'root',
})
export class FiltersDataService {
  private filtersSignal = signal<CanvasFilters | null>(null);
  currentFilters = this.filtersSignal.asReadonly();

  updateFilters(filters: CanvasFilters): void {
    console.log('Updating filters:', filters);
    this.filtersSignal.set(filters);
  }
}
