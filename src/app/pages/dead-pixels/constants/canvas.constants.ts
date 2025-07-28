const FILE_CONFIG = {
  ACCEPTED_TYPE: ['image/jpeg', 'image/png', 'image/gif'],
  MAX_SIZE: 5 * 1024 * 1024, // 5MB
};

const SENSITIVITY = {
  DEFAULT: 30,
  MIN: 0,
  MAX: 100,
};

/*
  0 -> dead pixel (black pixel)
  255 -> hot pixel (white pixel)
  Sensitivity is used to detect stuck pixels by comparing the pixel color with its neighbors.
*/
const PIXEL_DETECTION = {
  DEAD_THRESHOLD: 0,
  HOT_THRESHOLD: 255,
  SENSITIVITY: SENSITIVITY,
  COLOR_CHANNELS: {
    RED: 0,
    GREEN: 1,
    BLUE: 2,
    ALPHA: 3,
  },
  HIGHLIGHT_COLORS: {
    DEAD: [255, 0, 0], // Red: for dead pixels
    HOT: [0, 255, 0], // Green: for hot pixels
    STUCK: [255, 255, 0], // Yellow: for stuck pixels
  },
};

/*
  Zoom configuration for canvas and modal interactions
*/
const ZOOM_CONFIG = {
  DEFAULT: 100,
  MIN: 50,
  MAX: 500,
  STEP: 1.2,
  PRECISION_STEPS: [25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500],

  PAN: {
    DEFAULT_X: 0,
    DEFAULT_Y: 0,
    DAMPING: 0.8, // Damping factor for smooth panning
    BOUNDS_MARGIN: 50,
  },
};

const SAVED_CANVAS_NAME = 'dead-pixels-canvas';

export {
  FILE_CONFIG,
  SENSITIVITY,
  PIXEL_DETECTION,
  ZOOM_CONFIG,
  SAVED_CANVAS_NAME,
};
