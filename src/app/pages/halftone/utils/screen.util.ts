import { HalftoneShape } from '../constants/halftone.constants';

/**
 * Amplitude-modulated halftone screening.
 *
 * AM means the lattice spacing is constant and the DOT AREA carries the tone,
 * which is how offset and newsprint work. The whole tool rests on one identity:
 *
 *     ink area = density * cell area
 *
 * so every shape derives its linear dimension by inverting its own area
 * formula, which is where the square roots below come from.
 *
 * Driving the radius with density directly is the classic mistake. Measured on
 * a uniform patch at an 8px cell, radius = (cell / sqrt(2)) * density gives:
 *
 *   density   area correct   linear radius
 *   0.25      0.241          0.099
 *   0.50      0.528          0.397
 *   0.75      0.793          0.848
 *
 * Coverage there goes as density squared, so highlights and midtones wash out
 * badly before the curve overshoots in the three-quarter tones.
 *
 * The area-correct column reaches only 0.914 at full density: circles on a
 * square lattice leave a void at the cell corners, which is why `dotScale`
 * exists and why a real press shows the same pinholes in its solids.
 */

export type DensityMap = Uint8Array;

export interface ScreenOptions {
  cell: number;
  /** Screen angle in degrees. */
  angle: number;
  shape: HalftoneShape;
  /** Gamma on density. Above 1 lightens, below 1 darkens. */
  response: number;
  /** Linear multiplier on the dot dimension, as a fraction (1 = area correct). */
  dotScale: number;
  negative: boolean;
}

/** Aspect ratio of the elliptical dot, long axis over short. */
const ELLIPSE_ASPECT = 1.6;

/**
 * Reads one channel of `image` as ink density in 0-255, where 255 is solid.
 *
 * Built one channel at a time rather than all four at once: at export
 * resolution each map is tens of megabytes, and the caller screens and
 * discards them in sequence.
 */
export function buildDensity(
  image: ImageData,
  channel: 'mono' | 'c' | 'm' | 'y' | 'k',
): DensityMap {
  const { data } = image;
  const count = data.length / 4;
  const out = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const o = i * 4;
    const r = data[o] / 255;
    const g = data[o + 1] / 255;
    const b = data[o + 2] / 255;

    if (channel === 'mono') {
      // Rec. 709 luminance. Ink covers what light does not.
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      out[i] = (1 - lum) * 255;
      continue;
    }

    // Full GCR separation: all the neutral content is carried by black, and
    // the chromatic inks only cover what is left over. Without it the three
    // chromatic screens each carry a full grey component and the composite
    // turns to mud wherever the photo is dark.
    const k = 1 - Math.max(r, g, b);
    if (channel === 'k') {
      out[i] = k * 255;
      continue;
    }
    if (k >= 1) {
      out[i] = 0;
      continue;
    }
    const inv = 1 - k;
    const value =
      channel === 'c'
        ? (1 - r - k) / inv
        : channel === 'm'
          ? (1 - g - k) / inv
          : (1 - b - k) / inv;
    out[i] = Math.max(0, Math.min(1, value)) * 255;
  }

  return out;
}

/**
 * Screens one channel into an alpha mask: opaque where ink lands, transparent
 * where the paper shows through. The mask carries no colour, which is what
 * lets ink and paper be chosen afterwards without re-screening.
 */
export function buildScreen(
  density: DensityMap,
  width: number,
  height: number,
  options: ScreenOptions,
): HTMLCanvasElement {
  const { cell, shape, response, dotScale, negative } = options;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';

  const theta = (options.angle * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  // The lattice is walked in SCREEN space so the cells stay square under
  // rotation. Iterating image rows instead would shear the grid.
  const bounds = latticeBounds(width, height, cell, cos, sin);

  // Averaging over the cell rather than reading its centre pixel. A single
  // sample aliases badly on fine detail: a dot either lands on a highlight or
  // misses it, and hair or fabric breaks up into noise.
  const samples = Math.min(4, Math.max(1, Math.round(cell / 2)));
  const path = new Path2D();

  for (let j = bounds.jMin; j <= bounds.jMax; j++) {
    for (let i = bounds.iMin; i <= bounds.iMax; i++) {
      const cx = (i * cos - j * sin) * cell;
      const cy = (i * sin + j * cos) * cell;

      if (cx < -cell || cy < -cell || cx > width + cell || cy > height + cell) {
        continue;
      }

      let d = sampleCell(density, width, height, cx, cy, cell, cos, sin, samples);
      if (negative) d = 1 - d;
      if (d <= 0) continue;
      if (response !== 1) d = Math.pow(d, response);

      addDot(path, shape, cx, cy, cell, d, dotScale, cos, sin);
    }
  }

  // One fill for the whole screen. Filling per dot costs a state change and a
  // rasteriser flush each time, which at a 4px cell is a quarter of a million
  // of them.
  ctx.fill(path);
  return canvas;
}

/** Range of lattice indices whose cells can touch the image rectangle. */
function latticeBounds(
  width: number,
  height: number,
  cell: number,
  cos: number,
  sin: number,
): { iMin: number; iMax: number; jMin: number; jMax: number } {
  let iMin = Infinity;
  let iMax = -Infinity;
  let jMin = Infinity;
  let jMax = -Infinity;

  const corners = [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ];

  for (const [x, y] of corners) {
    const i = (x * cos + y * sin) / cell;
    const j = (-x * sin + y * cos) / cell;
    if (i < iMin) iMin = i;
    if (i > iMax) iMax = i;
    if (j < jMin) jMin = j;
    if (j > jMax) jMax = j;
  }

  return {
    iMin: Math.floor(iMin) - 1,
    iMax: Math.ceil(iMax) + 1,
    jMin: Math.floor(jMin) - 1,
    jMax: Math.ceil(jMax) + 1,
  };
}

/** Mean density over a k by k grid inside the rotated cell, in 0-1. */
function sampleCell(
  density: DensityMap,
  width: number,
  height: number,
  cx: number,
  cy: number,
  cell: number,
  cos: number,
  sin: number,
  k: number,
): number {
  if (k <= 1) return readDensity(density, width, height, cx, cy);

  const step = cell / k;
  const start = -cell / 2 + step / 2;
  let sum = 0;

  for (let a = 0; a < k; a++) {
    const u = start + a * step;
    for (let b = 0; b < k; b++) {
      const v = start + b * step;
      sum += readDensity(
        density,
        width,
        height,
        cx + u * cos - v * sin,
        cy + u * sin + v * cos,
      );
    }
  }

  return sum / (k * k);
}

/** Edge-clamped nearest lookup, returning 0-1. */
function readDensity(
  density: DensityMap,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  let px = Math.round(x);
  let py = Math.round(y);
  if (px < 0) px = 0;
  else if (px >= width) px = width - 1;
  if (py < 0) py = 0;
  else if (py >= height) py = height - 1;
  return density[py * width + px] / 255;
}

/**
 * Appends one dot of the right area to `path`.
 *
 * Every branch inverts its own area formula, so the shapes stay tonally
 * interchangeable: switching from circle to diamond changes the texture of the
 * print without changing how dark it reads.
 *
 * At full density an area-correct circle still leaves roughly 9% of the page
 * uncovered at the cell corners, exactly as a real press does. `dotScale`
 * above 100 is what closes it.
 */
function addDot(
  path: Path2D,
  shape: HalftoneShape,
  cx: number,
  cy: number,
  cell: number,
  density: number,
  dotScale: number,
  cos: number,
  sin: number,
): void {
  const area = density * cell * cell;
  if (area <= 0) return;

  switch (shape) {
    case 'circle': {
      const r = Math.sqrt(area / Math.PI) * dotScale;
      // Path2D.arc draws a line from the current point, so each dot has to
      // open its own subpath or the screen ends up stitched together.
      path.moveTo(cx + r, cy);
      path.arc(cx, cy, r, 0, Math.PI * 2);
      return;
    }
    case 'square': {
      const h = (Math.sqrt(area) / 2) * dotScale;
      // Square and diamond are drawn square to the PAGE, not to the screen
      // lattice. Turning them with the screen is what a PostScript spot
      // function does, but at the default 45 degree angle it made every
      // square come out looking like a diamond and every diamond like a
      // square, so the two controls appeared swapped. The lattice still
      // rotates, which is all that matters for moire; only the glyph is
      // pinned, and now the names describe what is on screen.
      addRotatedPolygon(
        path,
        cx,
        cy,
        [
          [-h, -h],
          [h, -h],
          [h, h],
          [-h, h],
        ],
        1,
        0,
      );
      return;
    }
    case 'diamond': {
      // Area of a rhombus is 2 * d^2 for half-diagonal d.
      const d = Math.sqrt(area / 2) * dotScale;
      addRotatedPolygon(
        path,
        cx,
        cy,
        [
          [0, -d],
          [d, 0],
          [0, d],
          [-d, 0],
        ],
        1,
        0,
      );
      return;
    }
    case 'ellipse': {
      const rx = Math.sqrt((area * ELLIPSE_ASPECT) / Math.PI) * dotScale;
      const ry = rx / ELLIPSE_ASPECT;
      path.moveTo(cx + rx * cos, cy + rx * sin);
      path.ellipse(cx, cy, rx, ry, Math.atan2(sin, cos), 0, Math.PI * 2);
      return;
    }
    case 'line': {
      // A bar spanning the cell, modulated in thickness only. This is the
      // line screen: area = cell * thickness.
      const half = cell / 2;
      const t = Math.min(cell, (area / cell) * dotScale) / 2;
      addRotatedPolygon(
        path,
        cx,
        cy,
        [
          [-half, -t],
          [half, -t],
          [half, t],
          [-half, t],
        ],
        cos,
        sin,
      );
      return;
    }
  }
}

/** Adds a polygon whose points are given in cell space, rotated into place. */
function addRotatedPolygon(
  path: Path2D,
  cx: number,
  cy: number,
  points: number[][],
  cos: number,
  sin: number,
): void {
  for (let i = 0; i < points.length; i++) {
    const [u, v] = points[i];
    const x = cx + u * cos - v * sin;
    const y = cy + u * sin + v * cos;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
}
