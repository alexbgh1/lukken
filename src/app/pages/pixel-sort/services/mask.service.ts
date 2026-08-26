import { Injectable, signal, computed } from '@angular/core';

export type BrushShape = 'circle' | 'ring';

export interface BrushSettings {
  size: number;
  opacity: number;
  color: string;
  shape: BrushShape;
  /**
   * Inner hole radius as a fraction of the outer radius, in [0, 1].
   * 0 = solid circle (default, no hole).
   * 0.5 = ring with inner radius half of outer.
   * 1 = zero-width ring (nothing painted).
   * Only used when shape === 'ring'.
   */
  hole: number;
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 40,
  opacity: 0.5,
  color: '#4fc3f7',
  shape: 'circle',
  hole: 0,
};

const MAX_UNDO_STEPS = 5;

@Injectable({
  providedIn: 'root',
})
export class PixelSortMaskService {
  private _maskCanvas: HTMLCanvasElement | null = null;
  private _maskCtx: CanvasRenderingContext2D | null = null;

  private _imageWidth = 0;
  private _imageHeight = 0;

  // Undo stack: each entry is an ImageData snapshot taken before a stroke begins
  private _undoStack: ImageData[] = [];
  private _strokeSnapshotSaved = false;

  // Cheap proxy for "is there anything painted?".
  // Incremented by paintAt, decremented by erase strokes.
  // Avoids full getImageData scans during active drawing.
  // Can go slightly stale (partial erases), so only used to set hasMask=true
  // eagerly; hasMask=false is only set on clearMask() and undo to empty snapshot.
  private _paintCallCount = 0;

  private _brushSettings = signal<BrushSettings>({ ...DEFAULT_BRUSH });
  private _hasMask = signal(false);
  private _isMaskEnabled = signal(true);
  private _canUndo = signal(false);

  readonly brushSettings = this._brushSettings.asReadonly();
  readonly hasMask = this._hasMask.asReadonly();
  readonly isMaskEnabled = this._isMaskEnabled.asReadonly();
  readonly canUndo = this._canUndo.asReadonly();

  readonly isActive = computed(() => this._hasMask() && this._isMaskEnabled());

  /**
   * Whether the mask is PAINTED over the canvas.
   *
   * Deliberately not the same thing as `isMaskEnabled`, which decides whether
   * the mask takes part in the sort. Once a sort has run, the overlay sits on
   * top of the very result it produced and hides it, so there has to be a way
   * to look underneath without discarding the selection.
   */
  private _isOverlayVisible = signal(true);
  readonly isOverlayVisible = this._isOverlayVisible.asReadonly();

  toggleOverlay(): void {
    this._isOverlayVisible.update((v) => !v);
  }

  initMask(width: number, height: number): void {
    this._imageWidth = width;
    this._imageHeight = height;

    if (!this._maskCanvas) {
      this._maskCanvas = document.createElement('canvas');
    }

    this._maskCanvas.width = width;
    this._maskCanvas.height = height;
    this._maskCtx = this._maskCanvas.getContext('2d', {
      willReadFrequently: true,
    })!;
    this._maskCtx.clearRect(0, 0, width, height);
    this._undoStack = [];
    this._strokeSnapshotSaved = false;
    this._paintCallCount = 0;
    this._hasMask.set(false);
    this._canUndo.set(false);
  }

  /**
   * Call this at the START of each stroke (mousedown / touchstart),
   * before any paintAt/eraseAt calls for that stroke.
   */
  beginStroke(): void {
    if (!this._maskCtx || !this._maskCanvas) return;
    if (this._strokeSnapshotSaved) return; // already saved for this stroke

    const snapshot = this._maskCtx.getImageData(
      0,
      0,
      this._imageWidth,
      this._imageHeight,
    );

    if (this._undoStack.length >= MAX_UNDO_STEPS) {
      this._undoStack.shift(); // drop oldest
    }
    this._undoStack.push(snapshot);
    this._strokeSnapshotSaved = true;
    this._canUndo.set(true);
  }

  /**
   * Call this at the END of each stroke (mouseup / touchend / mouseleave).
   * Does a single getImageData scan only when the paint counter suggests
   * the mask might be empty - avoids scanning on every erase point.
   */
  endStroke(): void {
    this._strokeSnapshotSaved = false;

    // Only scan when counter is at 0 (possible full erase) to confirm hasMask
    if (this._paintCallCount <= 0) {
      const isEmpty = this.isMaskEmpty();
      this._hasMask.set(!isEmpty);
      if (isEmpty) this._paintCallCount = 0;
    }
  }

  undo(): void {
    if (!this._maskCtx || !this._maskCanvas || this._undoStack.length === 0)
      return;

    const snapshot = this._undoStack.pop()!;
    this._maskCtx.putImageData(snapshot, 0, 0);

    // Check if the restored snapshot is empty - scan is justified here
    // since it happens once per undo action, not per brush point.
    const isEmpty = this.isMaskEmpty();
    this._hasMask.set(!isEmpty);
    // Resync counter: set to 1 if painted (exact value doesn't matter, just > 0),
    // or 0 if empty.
    this._paintCallCount = isEmpty ? 0 : 1;
    this._canUndo.set(this._undoStack.length > 0);
  }

  paintAt(normalizedX: number, normalizedY: number): void {
    if (!this._maskCtx || !this._maskCanvas) return;

    const x = normalizedX * this._imageWidth;
    const y = normalizedY * this._imageHeight;

    this._maskCtx.globalCompositeOperation = 'source-over';
    this._maskCtx.globalAlpha = 0.15;
    this._maskCtx.fillStyle = '#ffffff';
    this.drawBrushShape(x, y);

    this._paintCallCount++;
    this._hasMask.set(true);
  }

  eraseAt(normalizedX: number, normalizedY: number): void {
    if (!this._maskCtx || !this._maskCanvas) return;

    const x = normalizedX * this._imageWidth;
    const y = normalizedY * this._imageHeight;

    this._maskCtx.globalCompositeOperation = 'destination-out';
    this._maskCtx.globalAlpha = 1;
    this.drawBrushShape(x, y);

    // Decrement counter - clamp to 0. hasMask stays true until endStroke()
    // does a single cheap scan, avoiding per-point getImageData on 4K images.
    this._paintCallCount = Math.max(0, this._paintCallCount - 1);
    if (this._paintCallCount > 0) {
      this._hasMask.set(true);
    }
    // If counter hits 0 we leave hasMask as-is - endStroke() will verify cheaply
  }

  /**
   * Paints the brush shape at (x, y) using the current globalCompositeOperation
   * and globalAlpha. Handles both 'circle' (solid) and 'ring' (annulus) shapes.
   *
   * For 'ring': draws two concentric arcs with opposite winding and fills
   * with 'evenodd' rule - the inner circle becomes a hole. The inner radius
   * is `outer * hole` where `hole` ∈ [0, 1] comes from BrushSettings.
   *
   * `hole=0` reduces to a solid circle (same as 'circle' shape), so 'ring'
   * with hole=0 is visually identical to 'circle' - kept as a separate shape
   * only so the UI can show/hide the Hole slider contextually.
   */
  private drawBrushShape(x: number, y: number): void {
    if (!this._maskCtx) return;
    const brush = this._brushSettings();
    const outer = this.scaledBrushRadius();

    if (brush.shape === 'ring' && brush.hole > 0) {
      const inner = outer * Math.max(0, Math.min(1, brush.hole));
      this._maskCtx.beginPath();
      this._maskCtx.arc(x, y, outer, 0, Math.PI * 2);
      // Reverse-wound inner arc creates the hole via evenodd fill rule.
      this._maskCtx.arc(x, y, inner, 0, Math.PI * 2, true);
      this._maskCtx.fill('evenodd');
    } else {
      this._maskCtx.beginPath();
      this._maskCtx.arc(x, y, outer, 0, Math.PI * 2);
      this._maskCtx.fill();
    }
  }

  /**
   * Brush radius in NATIVE image pixels. `size` is a percentage of the
   * shorter image side, so size=40 is 40% of minDim.
   */
  private scaledBrushRadius(): number {
    return (
      (this.brushDiameterFraction() *
        Math.min(this._imageWidth, this._imageHeight)) /
      2
    );
  }

  clearMask(): void {
    if (!this._maskCtx || !this._maskCanvas) return;
    // Save to undo before clearing
    this.beginStroke();
    this.endStroke();
    this._maskCtx.clearRect(
      0,
      0,
      this._maskCanvas.width,
      this._maskCanvas.height,
    );
    this._paintCallCount = 0;
    this._hasMask.set(false);
  }

  /**
   * Single getImageData scan to check if the mask canvas is fully empty.
   * Only called at stroke end (when counter hits 0) or on undo - never mid-stroke.
   */
  private isMaskEmpty(): boolean {
    if (!this._maskCtx) return true;
    const data = this._maskCtx.getImageData(
      0,
      0,
      this._imageWidth,
      this._imageHeight,
    ).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return false;
    }
    return true;
  }

  toggleMask(): void {
    this._isMaskEnabled.update((v) => !v);
  }

  updateBrush(partial: Partial<BrushSettings>): void {
    this._brushSettings.update((current) => ({ ...current, ...partial }));
  }

  setBrushSize(size: number): void {
    this.updateBrush({ size });
  }

  /**
   * Returns the brush diameter as a fraction of min(width, height) -
   * e.g. size=40 → 0.4, size=200 → 2.0. Callers multiply by their local
   * min dimension (native image dims in paintAt/eraseAt, CSS display dims
   * in the cursor) so both produce the same on-screen size.
   *
   * Clamped to [0, 200] - values >100 produce a brush larger than the
   * shorter image side, useful for edge-to-edge masking.
   */
  brushDiameterFraction(): number {
    const sizePct =
      Math.max(0, Math.min(200, this._brushSettings().size)) / 100;
    return sizePct;
  }

  setBrushOpacity(opacity: number): void {
    this.updateBrush({ opacity });
  }

  setBrushColor(color: string): void {
    this.updateBrush({ color });
  }

  setBrushShape(shape: BrushShape): void {
    this.updateBrush({ shape });
  }

  /**
   * Sets the inner hole radius as a fraction [0, 1] of the outer radius.
   * Only meaningful when shape === 'ring'. Clamped to [0, 1].
   */
  setBrushHole(hole: number): void {
    this.updateBrush({ hole: Math.max(0, Math.min(1, hole)) });
  }

  getMaskImageData(): ImageData | null {
    if (!this._maskCtx || !this._maskCanvas) return null;
    return this._maskCtx.getImageData(
      0,
      0,
      this._imageWidth,
      this._imageHeight,
    );
  }

  getMaskCanvas(): HTMLCanvasElement | null {
    return this._maskCanvas;
  }

  get imageWidth(): number {
    return this._imageWidth;
  }
  get imageHeight(): number {
    return this._imageHeight;
  }
}
