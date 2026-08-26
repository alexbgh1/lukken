import { Injectable, computed, signal } from '@angular/core';
import {
  DEFAULT_GLASS_FILTERS,
  GlassFilters,
  GlassMaskMode,
  GlassPolygon,
  GlassRect,
  GlassTextureTransform,
  GLASS_CONFIG,
  polygonFromRect,
  rectFromPolygon,
} from '../constants/glass.constants';
import { ZoomLevel } from '@shared/utils/zoom';

@Injectable({
  providedIn: 'root',
})
export class GlassFiltersService {
  private _filters = signal<GlassFilters>({ ...DEFAULT_GLASS_FILTERS });

  // Mask rectangle in NATIVE working-canvas pixels. `null` until an image is
  // loaded, at which point it is seeded to the right-hand portion of the image.
  private _rect = signal<GlassRect | null>(null);

  // Free-corner region. Kept in sync with `_rect` so switching modes never
  // loses the area the user already framed - there is only ever one region.
  private _polygon = signal<GlassPolygon | null>(null);

  // Display-only state: never feeds the render, so changing it is free.
  private _zoom = signal<ZoomLevel>('fit');
  // What 'fit' actually resolved to, reported back by the view for the readout.
  private _effectiveScale = signal(1);

  // Mask chrome visibility. Toggled from the toolbar, or suppressed while the
  // user holds the peek key - both hide the frame without touching the result.
  private _showMaskOverlay = signal(true);
  private _peeking = signal(false);

  // Optional user-supplied height map. Overrides the procedural texture.
  private _customTexture = signal<HTMLImageElement | null>(null);
  private _customTextureName = signal<string | null>(null);

  readonly filters = this._filters.asReadonly();
  readonly rect = this._rect.asReadonly();
  readonly polygon = this._polygon.asReadonly();
  readonly zoom = this._zoom.asReadonly();
  readonly effectiveScale = this._effectiveScale.asReadonly();
  readonly showMaskOverlay = this._showMaskOverlay.asReadonly();
  readonly peeking = this._peeking.asReadonly();
  readonly customTexture = this._customTexture.asReadonly();
  readonly customTextureName = this._customTextureName.asReadonly();

  /** True when the editing frame should actually be painted. */
  readonly maskOverlayVisible = computed(
    () => this._showMaskOverlay() && !this._peeking(),
  );

  /** The UV transform, in the shape the texture generator expects. */
  readonly textureTransform = computed<GlassTextureTransform>(() => {
    const f = this._filters();
    return {
      scaleU: f.scaleU,
      scaleV: f.scaleV,
      offsetU: f.offsetU,
      offsetV: f.offsetV,
      rotation: f.rotation,
    };
  });

  /**
   * Identity of every input the DISPLACEMENT pass depends on.
   *
   * Compositing-only settings (feather, maskMode, rect) and view-only ones
   * (zoom, overlay) are deliberately excluded: dragging the mask or hiding the
   * frame must never re-run the expensive pass. Returns a primitive so signal
   * equality short-circuits redundant rebuilds.
   */
  readonly heavyKey = computed(() => {
    const f = this._filters();
    const custom = this._customTexture();
    return [
      f.texture,
      f.distortion,
      f.smoothness,
      f.scaleU,
      f.scaleV,
      f.offsetU,
      f.offsetV,
      f.rotation,
      f.blur,
      f.invert,
      custom ? custom.src : '',
    ].join('|');
  });

  updateFilters(partialFilters: Partial<GlassFilters>): void {
    this._filters.update((current) => ({ ...current, ...partialFilters }));
  }

  resetFilters(): void {
    this._filters.set({ ...DEFAULT_GLASS_FILTERS });
    this.clearCustomTexture();
  }

  setTexture(texture: GlassFilters['texture']): void {
    this.clearCustomTexture();
    this.updateFilters({ texture });
  }

  /**
   * Switching modes carries the region across rather than resetting it.
   * rect -> polygon seeds the corners; polygon -> rect snaps to the bounds,
   * which is lossy by nature since an axis-aligned box cannot hold a tilt.
   */
  setMaskMode(maskMode: GlassMaskMode): void {
    if (maskMode === 'polygon') {
      const rect = this._rect();
      if (rect) this._polygon.set(polygonFromRect(rect));
    } else if (maskMode === 'rect') {
      const polygon = this._polygon();
      if (polygon) this._rect.set(rectFromPolygon(polygon));
    }
    this.updateFilters({ maskMode });
  }

  toggleInvert(): void {
    this._filters.update((c) => ({ ...c, invert: !c.invert }));
  }

  // ── texture transform ──

  /** Honours the link toggle so uniform scaling stays the default behaviour. */
  setScale(axis: 'scaleU' | 'scaleV', value: number): void {
    this._filters.update((c) =>
      c.linkScale
        ? { ...c, scaleU: value, scaleV: value }
        : { ...c, [axis]: value },
    );
  }

  toggleLinkScale(): void {
    this._filters.update((c) => {
      if (c.linkScale) return { ...c, linkScale: false };
      // Re-linking snaps both axes to U so the pattern stops shearing.
      return { ...c, linkScale: true, scaleV: c.scaleU };
    });
  }

  resetTransform(): void {
    this.updateFilters({
      scaleU: GLASS_CONFIG.SCALE.DEFAULT,
      scaleV: GLASS_CONFIG.SCALE.DEFAULT,
      offsetU: GLASS_CONFIG.OFFSET.DEFAULT,
      offsetV: GLASS_CONFIG.OFFSET.DEFAULT,
      rotation: GLASS_CONFIG.ROTATION.DEFAULT,
    });
  }

  // ── view state ──

  setZoom(zoom: ZoomLevel): void {
    this._zoom.set(zoom);
  }

  setEffectiveScale(scale: number): void {
    this._effectiveScale.set(scale);
  }

  toggleMaskOverlay(): void {
    this._showMaskOverlay.update((v) => !v);
  }

  setPeeking(peeking: boolean): void {
    this._peeking.set(peeking);
  }

  // ── custom texture ──

  setCustomTexture(img: HTMLImageElement, name: string): void {
    const previous = this._customTexture();
    if (previous) URL.revokeObjectURL(previous.src);
    this._customTexture.set(img);
    this._customTextureName.set(name);
  }

  clearCustomTexture(): void {
    const previous = this._customTexture();
    if (previous) URL.revokeObjectURL(previous.src);
    this._customTexture.set(null);
    this._customTextureName.set(null);
  }

  // ── mask rectangle ──

  setRect(rect: GlassRect): void {
    this._rect.set(rect);
  }

  /** Seeds the mask to the right-hand slice of the image, as in the reference. */
  resetRect(width: number, height: number): void {
    const rect = {
      x: Math.round(width * 0.42),
      y: 0,
      w: Math.round(width * 0.58),
      h: height,
    };
    this._rect.set(rect);
    this._polygon.set(polygonFromRect(rect));
  }

  setPolygon(polygon: GlassPolygon): void {
    this._polygon.set(polygon);
  }

  /** Inserts a corner at `index`, splitting the edge that ends there. */
  insertPoint(index: number, point: { x: number; y: number }): void {
    this._polygon.update((current) => {
      if (!current) return current;
      const next = [...current];
      next.splice(index, 0, point);
      return next;
    });
  }

  /** Removes a corner, refusing to go below a triangle. */
  removePoint(index: number): void {
    this._polygon.update((current) => {
      if (
        !current ||
        current.length <= GLASS_CONFIG.CANVAS.MIN_POLYGON_POINTS
      ) {
        return current;
      }
      return current.filter((_, i) => i !== index);
    });
  }

  /** Corners are clamped individually; self-intersecting shapes are allowed. */
  clampPolygon(
    polygon: GlassPolygon,
    width: number,
    height: number,
  ): GlassPolygon {
    return polygon.map((p) => ({
      x: Math.min(Math.max(0, p.x), width),
      y: Math.min(Math.max(0, p.y), height),
    }));
  }

  /** Keeps the rectangle inside the image and above the minimum size. */
  clampRect(rect: GlassRect, width: number, height: number): GlassRect {
    const min = GLASS_CONFIG.CANVAS.MIN_RECT_SIZE;
    const w = Math.min(Math.max(min, rect.w), width);
    const h = Math.min(Math.max(min, rect.h), height);
    return {
      w,
      h,
      x: Math.min(Math.max(0, rect.x), width - w),
      y: Math.min(Math.max(0, rect.y), height - h),
    };
  }
}
