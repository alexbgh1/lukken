import { FormControl } from '@angular/forms';

export interface CanvasFilters {
  image: File | null;
  gridSize: number;
  nodeSize: number;
  spacing: number;
  connectivitySelector: 4 | 8;
}

export interface FiltersForm {
  image: FormControl<File | null>;
  gridSize: FormControl<number>;
  nodeSize: FormControl<number>;
  spacing: FormControl<number>;
  connectivitySelector: FormControl<4 | 8>;
}
