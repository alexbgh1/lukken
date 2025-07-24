import { FormControl } from '@angular/forms';

export type ConnectivityOptions = 4 | 8;

export interface CanvasFilters {
  image: File | null;
  gridSize: number;
  nodeSize: number;
  spacing: number;
  connectivitySelector: ConnectivityOptions;
}

export interface FiltersForm {
  image: FormControl<File | null>;
  gridSize: FormControl<number>;
  nodeSize: FormControl<number>;
  spacing: FormControl<number>;
  connectivitySelector: FormControl<ConnectivityOptions>;
}
