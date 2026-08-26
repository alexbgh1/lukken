import {
  Component,
  input,
  output,
  ChangeDetectionStrategy,
} from '@angular/core';

@Component({
  selector: 'slot-upload',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors overflow-hidden h-full w-full"
      [class.border-2]="!hasImage()"
      [class.border-dashed]="!hasImage()"
      [class.bg-bg-secondary]="!hasImage()"
      [class.border-border]="!hasImage() && !isDragging"
      [class.hover:border-accent-primary]="!hasImage()"
      [class.border-accent-primary]="!hasImage() && isDragging"
      [class.bg-accent-primary/10]="!hasImage() && isDragging"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      @if (previewUrl()) {
        <div class="relative w-full h-full group">
          <img
            [src]="previewUrl()"
            class="w-full h-full object-cover transition-opacity"
            [class.opacity-60]="isDragging"
          />
          <div
            class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end p-1.5"
          >
            <span
              class="text-3xs text-white/80 bg-black/40 px-1.5 py-0.5 rounded truncate max-w-full opacity-0 group-hover:opacity-100 transition-opacity"
              >{{ fileName() }}</span
            >
          </div>
        </div>
      } @else {
        <svg
          [class]="compact() ? 'w-3.5 h-3.5' : 'w-5 h-5'"
          class="text-text-muted shrink-0"
          viewBox="0 -960 960 960"
          fill="currentColor"
        >
          <path
            d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm280-80q-83 0-141.5-58.5T280-480q0-83 58.5-141.5T480-680q83 0 141.5 58.5T680-480q0 83-58.5 141.5T480-280Zm0-80q50 0 85-35t35-85q0-50-35-85t-85-35q-50 0-85 35t-35 85q0 50 35 85t85 35Z"
          />
        </svg>
        <span
          [class]="compact() ? 'text-3xs' : 'text-xs'"
          class="text-text-muted text-center px-1 leading-tight"
          >{{ label() }}</span
        >
        @if (!compact()) {
          <span class="text-3xs text-text-muted/60 text-center px-1"
            >Click or drag</span
          >
        }
      }
      <input
        type="file"
        accept="image/*"
        class="hidden"
        (change)="onFileSelected($event)"
      />
    </label>
  `,
})
export class SlotUploadComponent {
  label = input.required<string>();
  previewUrl = input<string | null>(null);
  hasImage = input(false);
  fileName = input('');
  compact = input(false);

  fileSelected = output<File>();

  isDragging = false;

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = false;

    const file = e.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      this.fileSelected.emit(file);
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.fileSelected.emit(file);
      input.value = '';
    }
  }
}
