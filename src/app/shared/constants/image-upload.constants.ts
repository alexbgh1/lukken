/**
 * The one place the upload limits live.
 *
 * These used to be redeclared per tool, which let them drift: Fractal Glass
 * accepted 15MB while 3D Nodes stopped at 5MB, and the shared
 * dropzone defaulted to a third value. A single constant keeps the limit and
 * the error message it produces in agreement.
 */
export const IMAGE_UPLOAD = {
  MAX_SIZE: 15 * 1024 * 1024,
  ACCEPTED_TYPE: ['image/*'],
} as const;
