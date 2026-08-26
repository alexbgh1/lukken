import { IMAGE_UPLOAD } from '@shared/constants';

export const HALFTONE_CONFIG = {
  // Screen ruling, expressed as the lattice spacing in working-canvas pixels.
  // Smaller cells mean more dots, so this is also the cost knob: the render
  // is O(pixels / cell^2) in dot count and O(pixels) in sampling.
  CELL: {
    MIN: 3,
    MAX: 40,
    DEFAULT: 8,
  },
  // Screen angle for mono. 45 degrees is the printer's default because a
  // diagonal lattice is the least visible to the eye.
  ANGLE: {
    MIN: 0,
    MAX: 90,
    DEFAULT: 45,
  },
  // Gamma applied to density before the area conversion. Above 1 lifts the
  // midtones (less ink), below 1 crushes them (more ink).
  RESPONSE: {
    MIN: 0.2,
    MAX: 3,
    DEFAULT: 1,
    STEP: 0.05,
  },
  // Linear multiplier on the computed dot dimension, as a percentage. Lets the
  // screen be opened past area-correct coverage to close the corner voids.
  DOT_SCALE: {
    MIN: 50,
    MAX: 160,
    DEFAULT: 100,
  },
  CANVAS: {
    // Working resolution cap for the preview.
    //
    // Unlike the other tools this cap is visible in the RESULT, not only in
    // the speed: cell size is measured in pixels, so the same setting over a
    // downscaled canvas yields a different dot count. Export compensates by
    // scaling the cell, see EXPORT below.
    MAX_DIMENSION: 2048,
  },
  EXPORT: {
    // Upper bound for the full-resolution pass. A halftone at 6000px holds
    // roughly nine times the dots of one at 2048px, which is the point of
    // exporting big, but the intermediate ImageData is already ~100MB there.
    MAX_DIMENSION: 6000,
  },
  FILE_CONFIG: IMAGE_UPLOAD,

  // The heavy pass is debounced so a slider drag coalesces into one run.
  REBUILD_DEBOUNCE_MS: 90,
} as const;

export const HALFTONE_SHAPES = [
  { value: 'circle', label: 'Circle' },
  { value: 'square', label: 'Square' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'line', label: 'Line' },
] as const;

export type HalftoneShape = (typeof HALFTONE_SHAPES)[number]['value'];

export type HalftoneMode = 'mono' | 'cmyk';

/** Which ink a screen is printed with. 'ink' resolves to the user's colour. */
export type HalftoneInk = 'ink' | 'c' | 'm' | 'y' | 'k';

/**
 * Traditional process screen angles.
 *
 * The 30 degree separation between cyan, magenta and black is what produces
 * the rosette. Yellow sits at 0 because it is the least visible ink, so the
 * 15 degree gap it is left with does the least damage. Two channels sharing an
 * angle produce a moire instead, which is precisely why these numbers are
 * fixed in the trade.
 */
export const PROCESS_ANGLES = {
  c: 15,
  m: 75,
  y: 0,
  k: 45,
} as const;

/**
 * Process ink colours, approximating SWOP rather than using pure RGB
 * secondaries. Pure #00ffff cyan prints as an electric blue that no press
 * produces, and the composite reads as a colour separation gone wrong.
 */
export const PROCESS_COLORS: Record<Exclude<HalftoneInk, 'ink'>, string> = {
  c: '#00aeef',
  m: '#ec008c',
  y: '#fff200',
  k: '#1a1a1a',
};

export interface HalftoneFilters {
  mode: HalftoneMode;
  cell: number;
  /** Screen angle used in mono mode. */
  angle: number;
  shape: HalftoneShape;
  response: number;
  dotScale: number;
  /**
   * Inverts density before screening, so the dots grow where the photo is
   * light. This changes the dot geometry, which is why it belongs to the
   * heavy pass and not to the recolouring pass.
   */
  negative: boolean;
  /** Per-channel overrides. Breaking them deliberately is how you get moire. */
  angleC: number;
  angleM: number;
  angleY: number;
  angleK: number;
  /** Recolouring only. Never re-runs the screen. */
  inkColor: string;
  paperColor: string;
}

export const DEFAULT_HALFTONE_FILTERS: HalftoneFilters = {
  mode: 'mono',
  cell: HALFTONE_CONFIG.CELL.DEFAULT,
  angle: HALFTONE_CONFIG.ANGLE.DEFAULT,
  shape: 'circle',
  response: HALFTONE_CONFIG.RESPONSE.DEFAULT,
  dotScale: HALFTONE_CONFIG.DOT_SCALE.DEFAULT,
  negative: false,
  angleC: PROCESS_ANGLES.c,
  angleM: PROCESS_ANGLES.m,
  angleY: PROCESS_ANGLES.y,
  angleK: PROCESS_ANGLES.k,
  inkColor: '#111111',
  paperColor: '#f4f1ea',
};

export interface HalftonePreset {
  label: string;
  ink: string;
  paper: string;
}

export const HALFTONE_PRESETS: HalftonePreset[] = [
  { label: 'Newsprint', ink: '#111111', paper: '#f4f1ea' },
  { label: 'Ink on white', ink: '#0a0a0a', paper: '#ffffff' },
  { label: 'Reversed', ink: '#f5f5f5', paper: '#101010' },
];
