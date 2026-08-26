export const PIXEL_SORT_CONFIG = {
  THRESHOLD: {
    MIN: 0,
    MAX: 256,
    DEFAULT: 90,
  },
  ANGLE: {
    MIN: 0,
    MAX: 360,
    DEFAULT: 135,
    PRESETS: [0, 45, 90, 135, 180, 225, 270, 315, 360],
  },
  CANVAS: {
    HISTOGRAM_WIDTH: 256,
    HISTOGRAM_HEIGHT: 150,
    ANGLE_CIRCLE_SIZE: 150,

    CIRCLE_MARGIN: 10,
    CIRCLE_LINE_MARGIN: 5,
    CIRCLE_DOT_RADIUS: 3,
    CIRCLE_STROKE_WIDTH: 2,
    CIRCLE_LINE_WIDTH: 3,
  },
} as const;

export const PIXEL_SORT_MODES = [
  { value: 'luma', label: 'Luma' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'red_green_ratio', label: 'Red Green Ratio' },
  { value: 'blue_emphasis', label: 'Blue Emphasis' },
  { value: 'luminance', label: 'Luminance' },
  { value: 'euclidean_distance', label: 'Euclidean Distance' },
  { value: 'cmy_cyan', label: 'CMY Cyan' },
  { value: 'cmy_magenta', label: 'CMY Magenta' },
  { value: 'cmy_yellow', label: 'CMY Yellow' },
  { value: 'xor', label: 'XOR' },
  { value: 'modulo', label: 'Modulo' },
] as const;

export type PixelSortMode = (typeof PIXEL_SORT_MODES)[number]['value'];

export interface PixelSortFilters {
  threshold: number;
  angle: number;
  mode: PixelSortMode;
  invert: boolean;
  stackOutput: boolean;
  circularSort: boolean;
  showGrid: boolean;
}

export interface Pivot {
  x: number;
  y: number;
}

export const DEFAULT_FILTERS: PixelSortFilters = {
  threshold: PIXEL_SORT_CONFIG.THRESHOLD.DEFAULT,
  angle: PIXEL_SORT_CONFIG.ANGLE.DEFAULT,
  mode: 'luma',
  invert: false,
  stackOutput: false,
  circularSort: false,
  showGrid: false,
};

export const COLORS = {
  ACCENT: 'rgb(230, 230, 230)',
  MUTED: 'rgb(140, 140, 140)',
} as const;
