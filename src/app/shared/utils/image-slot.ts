import { computed, signal } from '@angular/core';

/**
 * Holds the image a tool is currently working on, together with the object URL
 * used to preview it.
 *
 * Lives on a `providedIn: 'root'` service rather than in a component, so the
 * selection survives navigating away and back. Components mount and unmount;
 * the slot does not, which is why the preview no longer disappears on route
 * change. Each tool owns its own instance, so tools never share an image.
 *
 * The slot owns the object URL: it revokes the previous one on every `set` and
 * on `clear`, so callers must not revoke `url()` themselves.
 */
export class ImageSlot {
  private _file = signal<File | null>(null);
  private _url = signal<string | null>(null);

  readonly file = this._file.asReadonly();
  readonly url = this._url.asReadonly();
  readonly name = computed(() => this._file()?.name ?? null);
  readonly hasImage = computed(() => this._file() !== null);

  /** Stores `file` and returns the fresh object URL for it. */
  set(file: File): string {
    this.revoke();
    const url = URL.createObjectURL(file);
    this._file.set(file);
    this._url.set(url);
    return url;
  }

  clear(): void {
    this.revoke();
    this._file.set(null);
    this._url.set(null);
  }

  private revoke(): void {
    const previous = this._url();
    if (previous) URL.revokeObjectURL(previous);
  }
}
