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
  ConnectivityOptions,
  FormFilters,
} from '../../../interfaces/three-d-nodes-filters.interface';

import { FiltersDataService } from '../services/filters-data.service';
import { UploadIconComponent } from '../../../shared/icons';

@Component({
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    CommonModule,
    UploadIconComponent,
  ],
  selector: 'three-d-filters',
  templateUrl: './filters.component.html',
})
export class Three3dFiltersComponent {
  constructor(private filtersData: FiltersDataService) {}

  isDragging = false;
  fileDropError: string | null = null;

  FILE_CONFIG = FILTERS_CONFIG.FILE_CONFIG;
  GRID_SIZE = FILTERS_CONFIG.GRID_SIZE;
  NODE_SIZE = FILTERS_CONFIG.NODE_SIZE;
  SPACING = FILTERS_CONFIG.SPACING;
  CONNECTIVITY = FILTERS_CONFIG.CONNECTED_GROUP_NODES;
  CONNECTIVITY_OPTIONS = this.CONNECTIVITY.OPTIONS;

  canvasFiltersFormControl: FormGroup<FormFilters> = new FormGroup({
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
    ) as FormControl<ConnectivityOptions>,
  });

  onSubmit(): void {
    if (this.canvasFiltersFormControl.valid) {
      const formValue = this.canvasFiltersFormControl.value;

      /* Validate  all fields again before updating (to avoid interface problems) */
      if (
        !formValue.image ||
        formValue.gridSize === undefined ||
        formValue.nodeSize === undefined ||
        formValue.spacing === undefined ||
        formValue.connectivitySelector === undefined
      ) {
        console.error('Form value is null or undefined');
        return;
      }

      const filters: CanvasFilters = {
        image: formValue.image,
        gridSize: formValue.gridSize,
        nodeSize: formValue.nodeSize,
        spacing: formValue.spacing,
        connectivitySelector: Number(
          formValue.connectivitySelector
        ) as ConnectivityOptions,
      };

      this.filtersData.updateFilters(filters);
    }
  }

  /* File Drag and Drop and selection validation */

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  // Visual feedback: isDragging false
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  // Visual feedback: isDragging false and fileDropError null
  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    this.fileDropError = null;

    if (!event.dataTransfer?.files.length) return;

    const file = event.dataTransfer.files[0];
    this.validateAndSetFile(file);
  }

  private validateAndSetFile(file: File) {
    if (
      !file.type.match(
        this.FILE_CONFIG.ACCEPTED_TYPE.map((type) => type).join('|')
      )
    ) {
      this.fileDropError = 'Please only upload image files';
      return;
    }

    if (file.size > this.FILE_CONFIG.MAX_SIZE) {
      const maxSizeMB = this.FILE_CONFIG.MAX_SIZE / 1024 / 1024;
      this.fileDropError = `File exceeds ${maxSizeMB}MB`;
      return;
    }

    this.canvasFiltersFormControl.get('image')?.setValue(file);
    this.canvasFiltersFormControl.get('image')?.setErrors(null);
    this.fileDropError = null;
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    this.canvasFiltersFormControl.get('image')?.markAsTouched();

    if (file) {
      this.validateAndSetFile(file);
    } else {
      this.canvasFiltersFormControl.get('image')?.setValue(null);
    }
  }
}
