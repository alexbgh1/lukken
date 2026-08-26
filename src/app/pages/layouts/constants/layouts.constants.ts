import {
  PatternMap,
  PatternVariant,
  SlotDef,
  SlotRect,
} from '../interfaces/layout.interface';

// Slots tile each canvas exactly (no gap baked in). The gap is applied at
// render/generate time by insetting every interior slot edge by gap/2.
export const LAYOUT_PATTERNS: PatternMap = {
  'hero+2': {
    '4:3': {
      canvas: [2000, 1500],
      slots: [
        { name: 'main', x: 0, y: 0, w: 1000, h: 1500 },
        { name: 'top_right', x: 1000, y: 0, w: 1000, h: 750 },
        { name: 'bottom_right', x: 1000, y: 750, w: 1000, h: 750 },
      ],
    },
    '3:4': {
      canvas: [1500, 2000],
      slots: [
        { name: 'top', x: 0, y: 0, w: 1500, h: 1000 },
        { name: 'bottom_left', x: 0, y: 1000, w: 750, h: 1000 },
        { name: 'bottom_right', x: 750, y: 1000, w: 750, h: 1000 },
      ],
    },
  },
  split_half: {
    '4:3': {
      canvas: [2000, 1500],
      slots: [
        { name: 'left', x: 0, y: 0, w: 1000, h: 1500 },
        { name: 'right', x: 1000, y: 0, w: 1000, h: 1500 },
      ],
    },
    '3:4': {
      canvas: [1500, 2000],
      slots: [
        { name: 'top', x: 0, y: 0, w: 1500, h: 1000 },
        { name: 'bottom', x: 0, y: 1000, w: 1500, h: 1000 },
      ],
    },
  },
  hero_plus_3: {
    '4:3': {
      canvas: [2000, 1500],
      slots: [
        { name: 'hero', x: 0, y: 0, w: 1500, h: 1500 },
        { name: 'thumb_top', x: 1500, y: 0, w: 500, h: 500 },
        { name: 'thumb_middle', x: 1500, y: 500, w: 500, h: 500 },
        { name: 'thumb_bottom', x: 1500, y: 1000, w: 500, h: 500 },
      ],
    },
    '3:4': {
      canvas: [1500, 2000],
      slots: [
        { name: 'hero', x: 0, y: 0, w: 1500, h: 1500 },
        { name: 'thumb_left', x: 0, y: 1500, w: 500, h: 500 },
        { name: 'thumb_center', x: 500, y: 1500, w: 500, h: 500 },
        { name: 'thumb_right', x: 1000, y: 1500, w: 500, h: 500 },
      ],
    },
  },
  grid_2x2: {
    '4:3': {
      canvas: [2000, 1500],
      slots: [
        { name: 'top_left', x: 0, y: 0, w: 1000, h: 750 },
        { name: 'top_right', x: 1000, y: 0, w: 1000, h: 750 },
        { name: 'bottom_left', x: 0, y: 750, w: 1000, h: 750 },
        { name: 'bottom_right', x: 1000, y: 750, w: 1000, h: 750 },
      ],
    },
    '3:4': {
      canvas: [1500, 2000],
      slots: [
        { name: 'top_left', x: 0, y: 0, w: 750, h: 1000 },
        { name: 'top_right', x: 750, y: 0, w: 750, h: 1000 },
        { name: 'bottom_left', x: 0, y: 1000, w: 750, h: 1000 },
        { name: 'bottom_right', x: 750, y: 1000, w: 750, h: 1000 },
      ],
    },
  },
};

// The ceiling on Max Quality, which multiplies the whole canvas by an integer.
// Past the browser's canvas area limit, measured here at 268.5 Mpx and reached
// at scale 10, the failure is silent: toBlob calls back with null, and the null
// reaches URL.createObjectURL, which throws where nobody catches it.
//
// 4 puts the output at 8000x6000, 48 Mpx, about a fifth of that limit. It only
// bites the 2x2 grid in landscape, whose quarter-frame slots ask for twice the
// scale of any other pattern; a 6000 px camera file is untouched elsewhere.
export const MAX_OUTPUT_SCALE = 4;

export const GAP_OPTIONS = [0, 4, 8, 16] as const;
export const DEFAULT_GAP = 4;

// Insets every interior edge (one not touching the canvas border) by gap/2,
// so adjacent slots end up exactly `gap` canvas pixels apart.
export function insetSlotRect(
  slot: SlotDef,
  variant: PatternVariant,
  gap: number,
): SlotRect {
  const [cw, ch] = variant.canvas;
  const half = gap / 2;
  const left = slot.x > 0 ? half : 0;
  const top = slot.y > 0 ? half : 0;
  const right = slot.x + slot.w < cw ? half : 0;
  const bottom = slot.y + slot.h < ch ? half : 0;
  return {
    x: slot.x + left,
    y: slot.y + top,
    w: slot.w - left - right,
    h: slot.h - top - bottom,
  };
}
