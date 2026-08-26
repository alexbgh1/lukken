import { FormControl } from '@angular/forms';

export type CloudMode =
  | 'rgb-cube'
  | 'brightness-galaxy'
  | 'hue-ring'
  | 'saturation-burst';

export interface CanvasFilters {
  image: File | null;
  gridSize: number;
  nodeSize: number;
  spacing: number;
  colorCloud: boolean;
  cloudSamples: number;
  cloudMode: CloudMode;
  backgroundColor: string;
  bloomStrength: number;
  bloomEnabled: boolean;
  autoRotate: boolean;
  autoRotateSpeed: number;
}

export interface FormFilters {
  image: FormControl<File | null>;
  gridSize: FormControl<number>;
  nodeSize: FormControl<number>;
  spacing: FormControl<number>;
  colorCloud: FormControl<boolean>;
  cloudSamples: FormControl<number>;
  cloudMode: FormControl<CloudMode>;
  backgroundColor: FormControl<string>;
  bloomStrength: FormControl<number>;
  bloomEnabled: FormControl<boolean>;
  autoRotate: FormControl<boolean>;
  autoRotateSpeed: FormControl<number>;
}

export interface NodeMetrics {
  cellCount: number;
  nodeCount: number;
  compressionRatio: number;
}
