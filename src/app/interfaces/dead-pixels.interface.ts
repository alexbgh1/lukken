import { FormControl } from '@angular/forms';

export enum PixelType {
  DEAD = 'dead',
  STUCK = 'stuck',
  HOT = 'hot',
}

export const PIXEL_LEGENDS = {
  [PixelType.DEAD]: 'Dead Pixels',
  [PixelType.STUCK]: 'Stuck Pixels',
  [PixelType.HOT]: 'Hot Pixels',
};

export interface DeadPixel {
  x: number;
  y: number;
  type: PixelType;
}

/* Filters for Dead Pixels */
export interface CanvasFilters {
  image: File | null;
  sensitivity: number;
}

export interface FormFilters {
  image: FormControl<File | null>;
  sensitivity: FormControl<number>;
}
