/*
  Note: ThreeJS uses hexadecimal color values.
  Example: 0xFF0000 for red.

  This file handles almost all the constants to the Three-d-nodes canvas.
  The only value that is not included here is the connectivity selector
*/

const SCENE_CONFIG = {
  BACKGROUND_COLOR: 0x1a1a2e, // Dark purple background
  FOV: 75,
  NEAR_PLANE: 0.1,
  FAR_PLANE: 1000,
};

const CAMERA_CONFIG = {
  INITIAL_POSITION_Z: 30,
  MIN_DISTANCE: 10,
  CAMERA_DISTANCE_MULTIPLIER: 1.2,
  CAMERA_OFFSET_MULTIPLIER: 0.7,
};

const LIGHTING_CONFIG = {
  // https://threejs.org/docs/#api/en/lights/AmbientLight
  AMBIENT_LIGHT: {
    COLOR: 0xffffff,
    INTENSITY: 1,
  },
  // https://threejs.org/docs/#api/en/lights/DirectionalLight
  DIRECTIONAL_LIGHT: {
    COLOR: 0xffffff,
    INTENSITY: 0.6,
    POSITION: {
      X: 1,
      Y: 1,
      Z: 1,
    },
  },
};

// https://threejs.org/docs/#examples/en/controls/OrbitControls.dampingFactor
const CONTROLS_CONFIG = {
  ENABLE_DAMPING: true,
  DAMPING_FACTOR: 0.25,
};

const RENDERER_CONFIG = {
  ANTIALIAS: true,
};

const IMAGE_PROCESSING = {
  MAX_DIMENSION: 500,
  COLOR_CHANNELS: {
    RED: 0,
    GREEN: 1,
    BLUE: 2,
    ALPHA: 3,
  },
  RGBA_STEP: 4,
  COLOR_NORMALIZATION: 255,
};

const NODE_CONFIG = {
  GEOMETRY: {
    WIDTH_SEGMENTS: 16,
    HEIGHT_SEGMENTS: 16,
  },
  COLOR_COMPONENTS: 3, // RGB
};

const CONNECTION_CONFIG = {
  COLOR: 0x888888,
  OPACITY: 0.3,
  TRANSPARENT: true,
};

const CANVAS_CONFIG = {
  SCENE_CONFIG,
  CAMERA_CONFIG,
  LIGHTING_CONFIG,
  CONTROLS_CONFIG,
  RENDERER_CONFIG,
  IMAGE_PROCESSING,
  NODE_CONFIG,
  CONNECTION_CONFIG,
};

export {
  CANVAS_CONFIG,
  SCENE_CONFIG,
  CAMERA_CONFIG,
  LIGHTING_CONFIG,
  CONTROLS_CONFIG,
  RENDERER_CONFIG,
  IMAGE_PROCESSING,
  NODE_CONFIG,
  CONNECTION_CONFIG,
};
