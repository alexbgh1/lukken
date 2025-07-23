import { Component } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { DecimalPipe, CommonModule } from '@angular/common';

import { FILTERS_CONFIG } from '../constants/filters.constants';
import {
  CanvasFilters,
  FiltersForm,
} from '../../../interfaces/filters.interface';

import { FiltersDataService } from '../services/filters-data.service';

@Component({
  imports: [ReactiveFormsModule, DecimalPipe, CommonModule],
  selector: 'three-d-filters',
  templateUrl: './filters.component.html',
})
export class FiltersComponent {
  constructor(private filtersData: FiltersDataService) {}

  FILE_CONFIG = FILTERS_CONFIG.FILE_CONFIG;
  GRID_SIZE = FILTERS_CONFIG.GRID_SIZE;
  NODE_SIZE = FILTERS_CONFIG.NODE_SIZE;
  SPACING = FILTERS_CONFIG.SPACING;
  CONNECTIVITY = FILTERS_CONFIG.CONNECTED_GROUP_NODES;

  canvasFiltersFormControl: FormGroup<FiltersForm> = new FormGroup({
    image: new FormControl<File | null>(null, Validators.required),
    gridSize: new FormControl(this.GRID_SIZE.DEFAULT, [
      Validators.required,
      Validators.min(this.GRID_SIZE.MIN),
      Validators.max(this.GRID_SIZE.MAX),
    ]) as FormControl<number>,
    nodeSize: new FormControl(this.NODE_SIZE.DEFAULT, [
      Validators.required,
      Validators.min(this.NODE_SIZE.MIN),
      Validators.max(this.NODE_SIZE.MAX),
    ]) as FormControl<number>,
    spacing: new FormControl(this.SPACING.DEFAULT, [
      Validators.required,
      Validators.min(this.SPACING.MIN),
      Validators.max(this.SPACING.MAX),
    ]) as FormControl<number>,
    connectivitySelector: new FormControl(
      this.CONNECTIVITY.DEFAULT,
      Validators.required
    ) as FormControl<4 | 8>,
  });

  onSubmit(): void {
    if (this.canvasFiltersFormControl.valid) {
      this.filtersData.updateFilters(
        this.canvasFiltersFormControl.value as CanvasFilters
      );
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    this.canvasFiltersFormControl.get('image')?.markAsTouched();

    if (!file) {
      return this.canvasFiltersFormControl.get('image')?.setValue(null);
    }

    const isFileTooLarge = file.size > this.FILE_CONFIG.MAX_SIZE;

    if (isFileTooLarge) {
      const maxSizeMB = this.FILE_CONFIG.MAX_SIZE / 1024 / 1024;
      this.canvasFiltersFormControl.get('image')?.setErrors({
        maxSize: `
        Fille size exceeds ${maxSizeMB}MB`,
      });
      return;
    }

    this.canvasFiltersFormControl.get('image')?.setValue(file);
    this.canvasFiltersFormControl.get('image')?.setErrors(null);
  }
}
