import { IMAGE_UPLOAD } from '@shared/constants';

export const GLASS_CONFIG = {
  DISTORTION: {
    MIN: 0,
    MAX: 220,
    DEFAULT: 60,
  },
  SMOOTHNESS: {
    MIN: 1,
    MAX: 15,
    DEFAULT: 3,
  },
  // Texture UV transform. Scale is a percentage; higher stretches the pattern.
  SCALE: {
    MIN: 25,
    MAX: 400,
    DEFAULT: 100,
  },
  // Pans the pattern across the photo, in texture units.
  OFFSET: {
    MIN: -500,
    MAX: 500,
    DEFAULT: 0,
  },
  // Rotates the pattern - and therefore the direction the pixels smear,
  // since the displacement follows the gradient of the height map.
  ROTATION: {
    MIN: 0,
    MAX: 360,
    DEFAULT: 0,
  },
  BLUR: {
    MIN: 0,
    MAX: 30,
    DEFAULT: 3,
  },
  FEATHER: {
    MIN: 0,
    MAX: 80,
    DEFAULT: 0,
  },
  CANVAS: {
    // Working resolution cap. The displacement pass is O(pixels), so this
    // keeps slider drags responsive while staying above 2000px on the long
    // edge, which is enough for print and for most upload targets.
    // NOTE: this is the DATA size, which affects export quality. What the
    // image is displayed at is a separate concern, handled by the stage.
    MAX_DIMENSION: 2048,
    // Upper bound for the full-resolution export pass. The displacement is
    // O(pixels), so this is minutes-versus-seconds territory at the top end.
    EXPORT_MAX_DIMENSION: 6000,
    // Handle size for the mask region, in CSS pixels.
    HANDLE_SIZE: 9,
    MIN_RECT_SIZE: 24,
    // Below three corners there is no area left to mask.
    MIN_POLYGON_POINTS: 3,
    // How close a double-click must land to an edge to insert a corner there.
    EDGE_HIT_TOLERANCE: 14,
  },
  FILE_CONFIG: IMAGE_UPLOAD,

  // Heavy pass is debounced so dragging a slider coalesces into one run.
  REBUILD_DEBOUNCE_MS: 90,
} as const;

export const GLASS_TEXTURES = [
  { value: 'fractal', label: 'Fractal' },
  { value: 'wavy', label: 'Wavy' },
  { value: 'linear', label: 'Linear' },
  { value: 'ripple', label: 'Ripple' },
  { value: 'crystal', label: 'Crystal' },
  { value: 'brushed', label: 'Brushed' },
] as const;

export type GlassTexture = (typeof GLASS_TEXTURES)[number]['value'];

export type GlassMaskMode = 'full' | 'rect' | 'polygon';

export interface GlassRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface GlassPoint {
  x: number;
  y: number;
}

/**
 * An ordered ring of independent corners, clockwise from top-left.
 *
 * A rectangle is the special case where four corners happen to be
 * axis-aligned, so this covers rotated, trapezoidal and irregular regions
 * without needing a separate angle field or a fixed corner count.
 */
export type GlassPolygon = GlassPoint[];

/** Corners of `rect`, used to carry the region over when switching modes. */
export function polygonFromRect(rect: GlassRect): GlassPolygon {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
  ];
}

/** Axis-aligned bounds of `polygon`. Lossy: any tilt is discarded. */
export function rectFromPolygon(polygon: GlassPolygon): GlassRect {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/**
 * UV transform applied to the height map before it is sampled - the 2D
 * equivalent of the tiling/offset/rotation controls on a 3D displacement map.
 */
export interface GlassTextureTransform {
  scaleU: number;
  scaleV: number;
  offsetU: number;
  offsetV: number;
  rotation: number;
}

export interface GlassFilters {
  texture: GlassTexture;
  distortion: number;
  smoothness: number;
  scaleU: number;
  scaleV: number;
  offsetU: number;
  offsetV: number;
  rotation: number;
  /** When true, the two scale axes move together (uniform scaling). */
  linkScale: boolean;
  blur: number;
  feather: number;
  invert: boolean;
  maskMode: GlassMaskMode;
}

export const DEFAULT_GLASS_FILTERS: GlassFilters = {
  texture: 'fractal',
  distortion: GLASS_CONFIG.DISTORTION.DEFAULT,
  smoothness: GLASS_CONFIG.SMOOTHNESS.DEFAULT,
  scaleU: GLASS_CONFIG.SCALE.DEFAULT,
  scaleV: GLASS_CONFIG.SCALE.DEFAULT,
  offsetU: GLASS_CONFIG.OFFSET.DEFAULT,
  offsetV: GLASS_CONFIG.OFFSET.DEFAULT,
  rotation: GLASS_CONFIG.ROTATION.DEFAULT,
  linkScale: true,
  blur: GLASS_CONFIG.BLUR.DEFAULT,
  feather: GLASS_CONFIG.FEATHER.DEFAULT,
  invert: false,
  maskMode: 'full',
};
