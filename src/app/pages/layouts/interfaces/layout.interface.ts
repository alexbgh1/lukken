export type LayoutFormat = '4:3' | '3:4';
export type LayoutPattern =
  | 'hero+2'
  | 'split_half'
  | 'hero_plus_3'
  | 'grid_2x2';

export interface SlotDef {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SlotRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PatternVariant {
  canvas: [number, number];
  slots: SlotDef[];
}

export type PatternMap = Record<
  LayoutPattern,
  Record<LayoutFormat, PatternVariant>
>;

export interface SlotImage {
  name: string;
  file: File;
  url: string;
}

export interface CropResult {
  name: string;
  blob: Blob;
  url: string;
}

export interface LayoutResult {
  format: LayoutFormat;
  canvasBlob: Blob;
  canvasUrl: string;
  crops: CropResult[];
}
