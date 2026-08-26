import {
  GlassTexture,
  GlassTextureTransform,
} from '../constants/glass.constants';

/**
 * Procedural grayscale height maps.
 *
 * These replace the "load a texture file" step of the Photoshop Glass filter.
 * Every map is a smooth [0,1] field rendered to a grayscale canvas; the glass
 * pass then reads its GRADIENT (not its raw value) as a refraction offset.
 *
 * Smooth, low-frequency fields are what produce the flowing liquid-glass look -
 * downloaded PBR displacement maps (brick, concrete) read as rough/etched glass
 * instead, which is why these are generated rather than shipped as assets.
 */

/** Deterministic value-noise lattice - fixed seed so results are reproducible. */
const NOISE_TABLE = ((seed: number): Float32Array => {
  const t = new Float32Array(4096);
  let x = seed;
  for (let i = 0; i < 4096; i++) {
    x = (x * 1664525 + 1013904223) & 0x7fffffff;
    t[i] = x / 0x7fffffff;
  }
  return t;
})(7);

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const u = smooth(xf);
  const v = smooth(yf);
  const at = (a: number, b: number) => NOISE_TABLE[(a * 57 + b * 131) & 4095];
  return (
    (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) +
    (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v
  );
}

/** Fractional Brownian motion - stacked octaves of value noise. */
function fbm(x: number, y: number, octaves: number): number {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/**
 * Height at a point in TEXTURE space.
 *
 * (u, v) are centred on the transform origin, which is what lets `ripple`
 * stay concentric around the offset instead of around the raw canvas centre.
 */
function heightAt(kind: GlassTexture, u: number, v: number): number {
  switch (kind) {
    case 'fractal':
      return fbm(u / 55, v / 55, 5);
    case 'wavy':
      return 0.5 + 0.5 * Math.sin(v / 10 + 2.8 * Math.sin(u / 38));
    case 'linear':
      return 0.5 + 0.5 * Math.sin(v / 8);
    case 'ripple':
      return 0.5 + 0.5 * Math.sin(Math.hypot(u, v) / 9);
    case 'crystal':
      return 1 - Math.abs(fbm(u / 70, v / 70, 4) * 2 - 1);
    case 'brushed':
      return 0.5 + 0.35 * Math.sin(v / 3) + 0.15 * fbm(u / 12, v / 60, 3);
  }
}

export const IDENTITY_TRANSFORM: GlassTextureTransform = {
  scaleU: 100,
  scaleV: 100,
  offsetU: 0,
  offsetV: 0,
  rotation: 0,
};

/**
 * Renders a procedural height map at the given size.
 *
 * The UV transform is applied to the SAMPLE COORDINATES rather than to the
 * finished bitmap, so rotation and scaling stay resolution-independent (no
 * resampling, no seams). Rotating here also rotates the gradient, which is
 * what turns the directional maps (linear/wavy/brushed) diagonal.
 */
export function generateTexture(
  kind: GlassTexture,
  width: number,
  height: number,
  transform: GlassTextureTransform,
  invert: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(width, height);

  const rad = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Percentages: a larger scale must stretch the pattern, so it divides.
  const ku = 100 / (transform.scaleU || 100);
  const kv = 100 / (transform.scaleV || 100);
  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y++) {
    const dy = y - cy;
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const u = (dx * cos + dy * sin) * ku + transform.offsetU;
      const v = (-dx * sin + dy * cos) * kv + transform.offsetV;

      let value = heightAt(kind, u, v);
      value = value < 0 ? 0 : value > 1 ? 1 : value;
      if (invert) value = 1 - value;

      const i = (y * width + x) * 4;
      const p = value * 255;
      image.data[i] = p;
      image.data[i + 1] = p;
      image.data[i + 2] = p;
      image.data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Converts a user-supplied image into a grayscale height map of the target
 * size, honouring the same UV transform.
 *
 * Uploaded maps are finite, so the transform is done with canvas transforms on
 * a repeating pattern rather than per-pixel. Note: JPEG sources can band
 * visibly here - the glass pass takes a derivative, which amplifies
 * compression artifacts. PNG is preferred.
 */
export function textureFromImage(
  img: HTMLImageElement,
  width: number,
  height: number,
  transform: GlassTextureTransform,
  invert: boolean,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, width, height);

  const tile = document.createElement('canvas');
  tile.width = Math.max(2, img.naturalWidth || img.width);
  tile.height = Math.max(2, img.naturalHeight || img.height);
  tile.getContext('2d')!.drawImage(img, 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');

  if (pattern) {
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate((transform.rotation * Math.PI) / 180);
    ctx.scale((transform.scaleU || 100) / 100, (transform.scaleV || 100) / 100);
    ctx.translate(-transform.offsetU, -transform.offsetV);
    ctx.fillStyle = pattern;
    // Covers the frame at any rotation/scale.
    const reach = Math.hypot(width, height) * 2;
    ctx.fillRect(-reach, -reach, reach * 2, reach * 2);
    ctx.restore();
  }

  const data = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < data.data.length; i += 4) {
    let g =
      0.299 * data.data[i] +
      0.587 * data.data[i + 1] +
      0.114 * data.data[i + 2];
    if (invert) g = 255 - g;
    data.data[i] = g;
    data.data[i + 1] = g;
    data.data[i + 2] = g;
    data.data[i + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** Small untransformed preview used by the texture picker buttons. */
export function textureThumbnail(kind: GlassTexture, size = 56): string {
  return generateTexture(
    kind,
    size,
    size,
    { ...IDENTITY_TRANSFORM, scaleU: 55, scaleV: 55 },
    false,
  ).toDataURL('image/png');
}
