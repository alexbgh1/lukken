import {
  Component,
  ChangeDetectionStrategy,
  effect,
  signal,
  untracked,
} from '@angular/core';
import { ImageUploadComponent } from '@shared/components/image-upload/image-upload.component';
import { ChevronDownIconComponent } from '@shared/icons';
import {
  DEFAULT_GLASS_FILTERS,
  GLASS_CONFIG,
  GLASS_TEXTURES,
  GlassFilters,
  GlassTexture,
} from '../constants/glass.constants';
import { textureThumbnail } from '../utils/texture.util';
import { GlassCanvasService } from '../services/canvas.service';
import { GlassFiltersService } from '../services/filters.service';

/** The filter fields driven by a range input. */
type GlassNumericKey =
  | 'distortion'
  | 'smoothness'
  | 'scaleU'
  | 'scaleV'
  | 'offsetU'
  | 'offsetV'
  | 'rotation'
  | 'blur'
  | 'feather';

@Component({
  selector: 'glass-filters',
  imports: [ImageUploadComponent, ChevronDownIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './filters.component.html',
})
export class GlassFiltersComponent {
  CONFIG = GLASS_CONFIG;
  TEXTURES = GLASS_TEXTURES;
  FILE_CONFIG = GLASS_CONFIG.FILE_CONFIG;

  // The transform block is collapsed by default: five extra sliders would
  // otherwise dominate a panel most sessions never touch.
  transformOpen = signal(false);

  // Rendered once - each thumbnail is a tiny procedural render.
  thumbnails: Record<GlassTexture, string> = GLASS_TEXTURES.reduce(
    (acc, t) => {
      acc[t.value] = textureThumbnail(t.value);
      return acc;
    },
    {} as Record<GlassTexture, string>,
  );

  constructor(
    public filtersService: GlassFiltersService,
    public canvasService: GlassCanvasService,
  ) {
    // Only the displacement inputs are tracked here; feather/mask changes
    // repaint via the canvas component without re-running the filter.
    effect(() => {
      this.filtersService.heavyKey();
      untracked(() => {
        if (this.canvasService.hasImage()) {
          this.canvasService.scheduleRebuild();
        }
      });
    });
  }

  get filters(): GlassFilters {
    return this.filtersService.filters();
  }

  // ── image ──

  onImageSelected(file: File): void {
    this.canvasService.loadFile(file);
  }

  onImageCleared(): void {
    this.canvasService.clearImage();
  }

  // ── texture ──

  selectTexture(texture: GlassTexture): void {
    this.filtersService.setTexture(texture);
  }

  isTextureActive(texture: GlassTexture): boolean {
    return (
      !this.filtersService.customTexture() && this.filters.texture === texture
    );
  }

  onTextureFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    // URL stays alive: it doubles as the identity used by `heavyKey`.
    img.onload = () => this.filtersService.setCustomTexture(img, file.name);
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  clearCustomTexture(): void {
    this.filtersService.clearCustomTexture();
  }

  // ── numeric controls ──

  /** Keyed setter so every slider shares one code path. */
  setValue(key: GlassNumericKey, value: string | number): void {
    this.filtersService.updateFilters({ [key]: Number(value) });
  }

  /**
   * Double-click restores the default, matching 3D Nodes and Pixel Sort.
   * Paired with `isModified` it also drives the `slider-modified` thumb.
   */
  resetValue(key: GlassNumericKey): void {
    this.filtersService.updateFilters({ [key]: DEFAULT_GLASS_FILTERS[key] });
  }

  isModified(key: GlassNumericKey): boolean {
    return this.filters[key] !== DEFAULT_GLASS_FILTERS[key];
  }

  toggleInvert(): void {
    this.filtersService.toggleInvert();
  }

  // ── texture transform (UV) ──

  toggleTransform(): void {
    this.transformOpen.update((v) => !v);
  }

  /** Routed through the service so the link toggle can mirror both axes. */
  setScale(axis: 'scaleU' | 'scaleV', value: string | number): void {
    this.filtersService.setScale(axis, Number(value));
  }

  toggleLinkScale(): void {
    this.filtersService.toggleLinkScale();
  }

  resetTransform(): void {
    this.filtersService.resetTransform();
  }

  /** True when any UV control differs from its default. */
  isTransformModified(): boolean {
    return (
      this.isModified('scaleU') ||
      this.isModified('scaleV') ||
      this.isModified('offsetU') ||
      this.isModified('offsetV') ||
      this.isModified('rotation')
    );
  }

  // ── mask ──

  setMaskMode(mode: GlassFilters['maskMode']): void {
    this.filtersService.setMaskMode(mode);
  }

  /** Any masked mode shows the region controls. */
  isMasked(): boolean {
    return this.filters.maskMode !== 'full';
  }

  /** Reseeds both representations, so it works whichever mode is active. */
  resetRegion(): void {
    const size = this.canvasService.imageSize();
    if (size) this.filtersService.resetRect(size.width, size.height);
  }

  resetAll(): void {
    this.filtersService.resetFilters();
    const size = this.canvasService.imageSize();
    if (size) this.filtersService.resetRect(size.width, size.height);
  }
}
