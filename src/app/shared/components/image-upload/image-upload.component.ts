import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { UploadIconComponent, XIconComponent } from '@shared/icons';
import { IMAGE_UPLOAD } from '@shared/constants';

/**
 * The single image dropzone shared by every tool.
 * This component is the normalized version: preview thumbnail, filename, and a remove button, with drag & drop
 * It is presentational. The file itself is owned by the page's root service
 * (see `ImageSlot`), which is what makes the preview survive route changes.
 */
@Component({
  selector: 'image-upload',
  imports: [UploadIconComponent, XIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './image-upload.component.html',
})
export class ImageUploadComponent {
  inputId = input('imageInput');
  label = input('Image');
  previewUrl = input<string | null>(null);
  fileName = input<string | null>(null);
  accept = input(IMAGE_UPLOAD.ACCEPTED_TYPE.join(','));
  maxSize = input(IMAGE_UPLOAD.MAX_SIZE);
  error = input<string | null>(null);

  fileSelected = output<File>();
  cleared = output<void>();

  private _isDragging = signal(false);
  private _validationError = signal<string | null>(null);

  readonly isDragging = this._isDragging.asReadonly();
  /** Local validation wins, since it is the more specific complaint. */
  readonly message = computed(() => this._validationError() ?? this.error());

  readonly maxSizeMb = computed(() =>
    Math.round(this.maxSize() / (1024 * 1024)),
  );

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this._isDragging.set(true);
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this._isDragging.set(false);
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this._isDragging.set(false);
    const file = e.dataTransfer?.files[0];
    if (file) this.accept_(file);
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.accept_(file);
    // Allows re-selecting the same file after removing it.
    input.value = '';
  }

  /** The button sits inside the <label>, so the click must not open the picker. */
  onClear(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
    this._validationError.set(null);
    this.cleared.emit();
  }

  private accept_(file: File): void {
    if (!file.type.startsWith('image/')) {
      this._validationError.set('Please only upload image files');
      return;
    }
    if (file.size > this.maxSize()) {
      this._validationError.set(`Image is larger than ${this.maxSizeMb()} MB`);
      return;
    }
    this._validationError.set(null);
    this.fileSelected.emit(file);
  }
}
