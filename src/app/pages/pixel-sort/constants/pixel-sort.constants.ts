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
    MAX_DIMENSION: 2048,
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
}

export const DEFAULT_FILTERS: PixelSortFilters = {
  threshold: PIXEL_SORT_CONFIG.THRESHOLD.DEFAULT,
  angle: PIXEL_SORT_CONFIG.ANGLE.DEFAULT,
  mode: 'luma',
  invert: false,
  stackOutput: false,
};

const ACCENT_PINK = 'rgb(200, 109, 255)';
const MUTED_GRAY = 'rgb(128, 129, 146)';
export const COLORS = {
  ACCENT_PINK,
  MUTED_GRAY,
} as const;
