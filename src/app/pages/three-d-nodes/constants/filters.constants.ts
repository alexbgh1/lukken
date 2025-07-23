const FILE_CONFIG = {
  ACCEPTED_TYPE: ['image/*'],
  MAX_SIZE: 5 * 1024 * 1024,
};

const GRID_SIZE = {
  DEFAULT: 5,
  MIN: 5,
  MAX: 50,
};

const NODE_SIZE = {
  DEFAULT: 0.1,
  MIN: 0.1,
  MAX: 2,
};

const SPACING = {
  DEFAULT: 1,
  MIN: 1,
  MAX: 5,
};

const CONNECTED_GROUP_NODES = {
  DEFAULT: 4,
};

const FILTERS_CONFIG = {
  FILE_CONFIG,
  GRID_SIZE,
  NODE_SIZE,
  SPACING,
  CONNECTED_GROUP_NODES,
};

export { FILTERS_CONFIG };
