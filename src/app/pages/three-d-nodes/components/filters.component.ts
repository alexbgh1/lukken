import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  effect,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FILTERS_CONFIG } from '../constants/filters.constants';
import {
  CanvasFilters,
  CloudMode,
  FormFilters,
  NodeMetrics,
} from '@interfaces/three-d-nodes-filters.interface';

import { FiltersDataService } from '../services/filters-data.service';
import { ImageUploadComponent } from '@shared/components/image-upload/image-upload.component';

@Component({
  imports: [ReactiveFormsModule, ImageUploadComponent],
  selector: 'three-d-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filters.component.html',
})
export class Three3DFiltersComponent {
  isDragging = false;
  fileDropError: string | null = null;

  FILE_CONFIG = FILTERS_CONFIG.FILE_CONFIG;
  GRID_SIZE = FILTERS_CONFIG.GRID_SIZE;
  NODE_SIZE = FILTERS_CONFIG.NODE_SIZE;
  SPACING = FILTERS_CONFIG.SPACING;
  COLOR_CLOUD = FILTERS_CONFIG.COLOR_CLOUD;
  CLOUD_SAMPLES = FILTERS_CONFIG.CLOUD_SAMPLES;
  CLOUD_MODE_LIST = FILTERS_CONFIG.CLOUD_MODE_LIST;
  BACKGROUND_COLOR_LIST = FILTERS_CONFIG.BACKGROUND_COLOR_LIST;
  BLOOM_STRENGTH = FILTERS_CONFIG.BLOOM_STRENGTH;
  BLOOM_ENABLED = FILTERS_CONFIG.BLOOM_ENABLED;
  AUTO_ROTATE = FILTERS_CONFIG.AUTO_ROTATE;

  nodeMetrics: NodeMetrics | null = null;
  interactiveEnabled = false;

  constructor(
    public filtersData: FiltersDataService,
    private cdr: ChangeDetectorRef,
  ) {
    effect(() => {
      this.nodeMetrics = this.filtersData.nodeMetrics();
      this.cdr.markForCheck();
    });
    effect(() => {
      this.interactiveEnabled = this.filtersData.interactive();
      this.cdr.markForCheck();
    });

    // Re-populate the form from the slot so returning to this route keeps the
    // selection (the form lives on the component and is rebuilt each visit).
    const remembered = this.filtersData.imageSlot.file();
    if (remembered) {
      this.canvasFiltersFormControl.get('image')?.setValue(remembered);
      this.canvasFiltersFormControl.get('image')?.setErrors(null);
    }
  }

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
    colorCloud: new FormControl(this.COLOR_CLOUD.DEFAULT, {
      nonNullable: true,
    }) as FormControl<boolean>,
    cloudSamples: new FormControl(this.CLOUD_SAMPLES.DEFAULT, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(this.CLOUD_SAMPLES.MIN),
        Validators.max(this.CLOUD_SAMPLES.MAX),
      ],
    }) as FormControl<number>,
    cloudMode: new FormControl<CloudMode>(this.CLOUD_MODE_LIST[0].value, {
      nonNullable: true,
    }),
    backgroundColor: new FormControl<string>(
      this.BACKGROUND_COLOR_LIST[3].value,
      { nonNullable: true },
    ),
    bloomStrength: new FormControl<number>(this.BLOOM_STRENGTH.DEFAULT, {
      nonNullable: true,
    }),
    bloomEnabled: new FormControl<boolean>(this.BLOOM_ENABLED.DEFAULT, {
      nonNullable: true,
    }),
    autoRotate: new FormControl<boolean>(this.AUTO_ROTATE.DEFAULT, {
      nonNullable: true,
    }),
    autoRotateSpeed: new FormControl<number>(this.AUTO_ROTATE.SPEED_DEFAULT, {
      nonNullable: true,
    }),
  });

  toggleColorCloud(): void {
    this.canvasFiltersFormControl
      .get('colorCloud')
      ?.setValue(!this.canvasFiltersFormControl.value.colorCloud);
    this.onSubmit();
  }

  setCloudMode(mode: CloudMode): void {
    this.canvasFiltersFormControl.get('cloudMode')?.setValue(mode);
  }

  setBackground(color: string): void {
    this.canvasFiltersFormControl.get('backgroundColor')?.setValue(color);
    this.onSubmit();
  }

  toggleInteractive(): void {
    const next = !this.filtersData.interactive();
    this.filtersData.updateInteractive(next);
  }

  resetCloudSamples(): void {
    this.canvasFiltersFormControl
      .get('cloudSamples')
      ?.setValue(this.CLOUD_SAMPLES.DEFAULT, { emitEvent: false });
  }

  resetGrid(): void {
    this.canvasFiltersFormControl
      .get('gridSize')
      ?.setValue(this.GRID_SIZE.DEFAULT, { emitEvent: false });
  }

  resetNodeSize(): void {
    this.canvasFiltersFormControl
      .get('nodeSize')
      ?.setValue(this.NODE_SIZE.DEFAULT, { emitEvent: false });
  }

  resetSpacing(): void {
    this.canvasFiltersFormControl
      .get('spacing')
      ?.setValue(this.SPACING.DEFAULT, { emitEvent: false });
  }

  onSubmit(): void {
    if (this.canvasFiltersFormControl.valid) {
      const formValue = this.canvasFiltersFormControl.value;

      if (
        !formValue.image ||
        formValue.gridSize == null ||
        formValue.nodeSize == null ||
        formValue.spacing == null ||
        formValue.cloudSamples == null
      ) {
        return;
      }

      const filters: CanvasFilters = {
        image: formValue.image,
        gridSize: formValue.gridSize,
        nodeSize: formValue.nodeSize,
        spacing: formValue.spacing,
        colorCloud: formValue.colorCloud ?? false,
        cloudSamples: formValue.cloudSamples,
        cloudMode: formValue.cloudMode ?? 'rgb-cube',
        backgroundColor: formValue.backgroundColor ?? '#0f0f0f',
        bloomStrength: formValue.bloomStrength ?? this.BLOOM_STRENGTH.DEFAULT,
        bloomEnabled: formValue.bloomEnabled ?? this.BLOOM_ENABLED.DEFAULT,
        autoRotate: formValue.autoRotate ?? this.AUTO_ROTATE.DEFAULT,
        autoRotateSpeed:
          formValue.autoRotateSpeed ?? this.AUTO_ROTATE.SPEED_DEFAULT,
      };

      this.filtersData.updateFilters(filters);
    }
  }

  onImageSelected(file: File): void {
    this.filtersData.setLoadError(null);
    this.filtersData.imageSlot.set(file);
    this.canvasFiltersFormControl.get('image')?.setValue(file);
    this.canvasFiltersFormControl.get('image')?.setErrors(null);
    this.fileDropError = null;
    this.onSubmit();
  }

  onImageCleared(): void {
    this.filtersData.imageSlot.clear();
    this.canvasFiltersFormControl.get('image')?.setValue(null);
    this.fileDropError = null;
  }
}
