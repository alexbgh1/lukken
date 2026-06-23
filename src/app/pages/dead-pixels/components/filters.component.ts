import { Component, ChangeDetectionStrategy } from '@angular/core';
import { UploadIconComponent } from '@shared/icons';
import {
  FormGroup,
  ReactiveFormsModule,
  FormControl,
  Validators,
} from '@angular/forms';
import { FILE_CONFIG, SENSITIVITY } from '../constants/canvas.constants';
import {
  CanvasFilters,
  FormFilters,
} from '@interfaces/dead-pixels.interface';
import { FiltersDataService } from '../services/filters-data.service';

@Component({
  imports: [ReactiveFormsModule, UploadIconComponent],
  selector: 'dead-pixels-filters',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './filters.component.html',
})
export class DeadPixelsFiltersComponent {
  constructor(private filtersData: FiltersDataService) {}

  isDragging = false;
  fileDropError: string | null = null;

  FILE_CONFIG = FILE_CONFIG;
  SENSITIVITY = SENSITIVITY;

  canvasFiltersFormControl: FormGroup<FormFilters> = new FormGroup({
    image: new FormControl<File | null>(null, Validators.required),
    sensitivity: new FormControl<number>(this.SENSITIVITY.DEFAULT, [
      Validators.required,
      Validators.min(this.SENSITIVITY.MIN),
      Validators.max(this.SENSITIVITY.MAX),
    ]) as FormControl<number>,
  });

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    this.fileDropError = null;

    if (!event.dataTransfer?.files.length) return;

    const file = event.dataTransfer.files[0];
    this.validateAndSetFile(file);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;

    if (file) {
      this.validateAndSetFile(file);
    }
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

  onSubmit(): void {
    if (this.canvasFiltersFormControl.valid) {
      const formValue = this.canvasFiltersFormControl.value;

      /* Validate  all fields again before updating (to avoid interface problems) */
      if (!formValue.image || formValue.sensitivity == null) {
        console.error('Form value is null or undefined');
        return;
      }

      const filters: CanvasFilters = {
        image: formValue.image,
        sensitivity: formValue.sensitivity,
      };

      this.filtersData.updateFilters(filters);
    }
  }
}
