import { IMAGE_UPLOAD } from '@shared/constants';

const FILE_CONFIG = IMAGE_UPLOAD;

const GRID_SIZE = {
  DEFAULT: 8,
  MIN: 4,
  MAX: 50,
};

const NODE_SIZE = {
  DEFAULT: 1,
  MIN: 0.1,
  MAX: 2,
};

const SPACING = {
  DEFAULT: 1,
  MIN: 1,
  MAX: 5,
};

const COLOR_CLOUD = {
  DEFAULT: false,
};

const CLOUD_SAMPLES = {
  DEFAULT: 5000,
  MIN: 500,
  MAX: 50000,
  STEP: 500,
};

const CLOUD_MODE_LIST = [
  { value: 'rgb-cube' as const, label: 'RGB Cube' },
  { value: 'brightness-galaxy' as const, label: 'Galaxy' },
  { value: 'hue-ring' as const, label: 'Hue Ring' },
  { value: 'saturation-burst' as const, label: 'Saturation' },
];

const BACKGROUND_COLOR_LIST = [
  { value: '#f5f5f5', label: 'White' },
  { value: '#808080', label: 'Mid Gray' },
  { value: '#000000', label: 'Black' },
  { value: '#0f0f0f', label: 'Near Black' },
  { value: '#1a1a2e', label: 'Navy' },
  { value: '#2a2520', label: 'Warm' },
  { value: '#1f1f1f', label: 'Dark Gray' },
];

const BLOOM_STRENGTH = {
  DEFAULT: 0.3,
  MIN: 0,
  MAX: 3,
  STEP: 0.05,
};

const BLOOM_ENABLED = {
  DEFAULT: false,
};

const AUTO_ROTATE = {
  DEFAULT: false,
  SPEED_DEFAULT: 0.3,
  SPEED_MIN: 0.1,
  SPEED_MAX: 2.0,
  SPEED_STEP: 0.1,
};

const FILTERS_CONFIG = {
  FILE_CONFIG,
  GRID_SIZE,
  NODE_SIZE,
  SPACING,
  COLOR_CLOUD,
  CLOUD_SAMPLES,
  CLOUD_MODE_LIST,
  BACKGROUND_COLOR_LIST,
  BLOOM_STRENGTH,
  BLOOM_ENABLED,
  AUTO_ROTATE,
};

export { FILTERS_CONFIG };
