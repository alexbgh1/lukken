import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  inject,
  signal,
  effect,
  ChangeDetectionStrategy,
  input,
} from '@angular/core';
import {
  XIconComponent,
  PencilIconComponent,
  BrushIconComponent,
  EraserIconComponent,
  TrashIconComponent,
  UndoIconComponent,
} from '@shared/icons';
import { PixelSortMaskService } from '../services/mask.service';
import { PixelSortCanvasService } from '../services/canvas.service';
import { PixelSortFiltersService } from '../services/filters.service';

type BrushMode = 'paint' | 'erase';

@Component({
  selector: 'pixel-sort-mask-canvas',
  standalone: true,
  imports: [
    XIconComponent,
    PencilIconComponent,
    BrushIconComponent,
    EraserIconComponent,
    TrashIconComponent,
    UndoIconComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mask-canvas-wrapper"
      [style.display]="hasImage() ? 'block' : 'none'"
    >
      <canvas
        #maskCanvas
        class="mask-canvas"
        (mousedown)="onPointerDown($event)"
        (mousemove)="onPointerMove($event)"
        (mouseup)="onPointerUp()"
        (mouseleave)="onPointerLeave()"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd()"
        [style.cursor]="getBrushCursor()"
      ></canvas>

      <!-- Mode indicator badge - top center of canvas -->
      @if (fabOpen()) {
        <div class="mode-badge" [class.erase-mode]="brushMode() === 'erase'">
          {{ brushMode() === 'paint' ? 'Paint - Z' : 'Erase - X' }}
        </div>
      }

      <!-- Axis lock indicator - shown whenever Shift is constraining the stroke -->
      @if (shiftLocked()) {
        <div class="axis-badge">
          ⇔
          {{ shiftLocked() === 'horizontal' ? 'Horizontal' : 'Vertical' }}
          locked
        </div>
      }

      <!-- Floating action button (FAB) in bottom-right corner -->
      <div class="fab-container">
        <!-- Main toggle button -->
        <button
          class="fab-main"
          (click)="toggleFab()"
          [title]="fabOpen() ? 'Close tools' : 'Brush tools'"
        >
          @if (fabOpen()) {
            <x-icon className="w-5 h-5" />
          } @else {
            <pencil-icon className="w-5 h-5" />
          }
        </button>

        <!-- Expanded actions -->
        @if (fabOpen()) {
          <div class="fab-actions">
            <!-- Undo -->
            <button
              class="fab-action"
              [class.disabled]="!maskService.canUndo()"
              [disabled]="!maskService.canUndo()"
              (click)="undo()"
              title="Undo last stroke (Ctrl+Z)"
            >
              <undo-icon className="w-4 h-4" />
              <span class="fab-action-label">Undo</span>
              <kbd>Ctrl Z</kbd>
            </button>

            <!-- Paint -->
            <button
              class="fab-action"
              [class.active-paint]="brushMode() === 'paint'"
              (click)="setBrushMode('paint')"
              title="Paint mode (Z)"
            >
              <brush-icon className="w-4 h-4" />
              <span class="fab-action-label">Paint</span>
              <kbd>Z</kbd>
            </button>

            <!-- Erase -->
            <button
              class="fab-action"
              [class.active-erase]="brushMode() === 'erase'"
              (click)="setBrushMode('erase')"
              title="Erase mode (X)"
            >
              <eraser-icon className="w-4 h-4" />
              <span class="fab-action-label">Erase</span>
              <kbd>X</kbd>
            </button>

            <!-- Clear -->
            <button
              class="fab-action danger"
              [class.disabled]="!maskService.hasMask()"
              [disabled]="!maskService.hasMask()"
              (click)="clearMask()"
              title="Clear all mask"
            >
              <trash-icon className="w-4 h-4" />
              <span class="fab-action-label">Clear</span>
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .mask-canvas-wrapper {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }

      .mask-canvas {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: all;
      }

      /* ── FAB ──────────────────────────────────────── */

      .fab-container {
        position: absolute;
        bottom: 16px;
        right: 16px;
        display: flex;
        flex-direction: column-reverse;
        align-items: flex-end;
        gap: 8px;
        pointer-events: all;
      }

      .fab-main {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 1px solid rgba(255, 255, 255, 0.2);
        background: rgba(15, 15, 20, 0.82);
        backdrop-filter: blur(6px);
        color: #fff;
        font-size: 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
          background 0.15s,
          border-color 0.15s,
          transform 0.15s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
        flex-shrink: 0;
      }

      .fab-main:hover {
        background: rgba(30, 30, 40, 0.92);
        border-color: rgba(255, 255, 255, 0.35);
      }

      .fab-icon {
        line-height: 1;
        user-select: none;
      }

      .fab-actions {
        display: flex;
        flex-direction: column;
        gap: 6px;
        align-items: flex-end;
        animation: fab-in 0.15s ease;
      }

      @keyframes fab-in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .fab-action {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 10px 5px 8px;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(15, 15, 20, 0.82);
        backdrop-filter: blur(6px);
        color: rgb(180, 180, 180);
        font-size: 12px;
        cursor: pointer;
        transition:
          background 0.12s,
          border-color 0.12s,
          color 0.12s;
        white-space: nowrap;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
      }

      .fab-action:hover:not([disabled]) {
        background: rgba(40, 40, 55, 0.9);
        color: rgb(220, 220, 220);
        border-color: rgba(255, 255, 255, 0.22);
      }

      .fab-action.active-paint {
        background: rgba(79, 195, 247, 0.15);
        border-color: rgb(79, 195, 247);
        color: rgb(79, 195, 247);
      }

      .fab-action.active-erase {
        background: rgba(255, 183, 77, 0.15);
        border-color: rgb(255, 183, 77);
        color: rgb(255, 183, 77);
      }

      .fab-action.danger {
        border-color: rgba(255, 90, 90, 0.3);
        color: rgb(255, 110, 110);
      }

      .fab-action.danger:hover:not([disabled]) {
        background: rgba(255, 90, 90, 0.12);
      }

      .fab-action.disabled,
      .fab-action[disabled] {
        opacity: 0.35;
        cursor: not-allowed;
      }

      .fab-action-icon {
        font-size: 14px;
        line-height: 1;
      }

      .fab-action-label {
        flex: 1;
      }

      kbd {
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 3px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background: rgba(255, 255, 255, 0.06);
        color: rgb(140, 140, 140);
        font-family: system-ui, monospace;
        letter-spacing: var(--tracking-wide);
      }

      /* ── Mode badge ──────────────────────────────── */

      .mode-badge {
        position: absolute;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        padding: 3px 10px;
        border-radius: 12px;
        border: 1px solid rgba(79, 195, 247, 0.4);
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(4px);
        color: rgb(79, 195, 247);
        font-size: 11px;
        pointer-events: none;
        white-space: nowrap;
        animation: fade-in 0.2s ease;
      }

      .mode-badge.erase-mode {
        border-color: rgba(255, 183, 77, 0.4);
        color: rgb(255, 183, 77);
      }

      @keyframes fade-in {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      /* ── Axis lock badge ─────────────────────────── */

      .axis-badge {
        position: absolute;
        top: 44px;
        left: 50%;
        transform: translateX(-50%);
        padding: 3px 10px;
        border-radius: 12px;
        border: 1px solid rgba(180, 130, 255, 0.5);
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(4px);
        color: rgb(200, 160, 255);
        font-size: 11px;
        pointer-events: none;
        white-space: nowrap;
        animation: fade-in 0.15s ease;
      }
    `,
  ],
})
export class PixelSortMaskCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('maskCanvas') maskCanvasRef!: ElementRef<HTMLCanvasElement>;

  hasImage = input<boolean>(false);

  readonly maskService = inject(PixelSortMaskService);
  private canvasService = inject(PixelSortCanvasService);
  private filtersService = inject(PixelSortFiltersService);

  readonly brushMode = signal<BrushMode>('paint');
  readonly fabOpen = signal(false);
  readonly shiftLocked = signal<'horizontal' | 'vertical' | null>(null);
  readonly isDraggingPivot = signal(false);

  private isDrawing = false;
  private isPivotDrag = false;
  private lastX = 0;
  private lastY = 0;
  private shiftAnchorX = 0;
  private shiftAnchorY = 0;
  private displayCtx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;

  // Brush preview position in display (CSS) pixels, null when not hovering.
  // Used by renderOverlay() to draw an on-canvas outline that matches the
  // painted mask 1:1 - the CSS cursor approach is unreliable because
  // browsers cap cursor size (~128px) and SVG cursors don't render the
  // annulus shape accurately.
  private brushPreviewX: number | null = null;
  private brushPreviewY: number | null = null;

  constructor() {
    effect(() => {
      const img = this.canvasService.originalImage();
      if (img && this.maskCanvasRef?.nativeElement) {
        this.resizeCanvas();
      }
    });
  }

  ngAfterViewInit(): void {
    this.displayCtx = this.maskCanvasRef.nativeElement.getContext('2d')!;
    this.resizeCanvas();
    this.startRenderLoop();
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    const tag = (event.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    if (event.key === 'z' || event.key === 'Z') {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.undo();
      } else {
        this.setBrushMode('paint');
      }
      return;
    }

    if (event.key === 'x' || event.key === 'X') {
      this.setBrushMode('erase');
      return;
    }
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.key === 'Shift') {
      this.shiftLocked.set(null);
    }
  }

  toggleFab(): void {
    this.fabOpen.update((v) => !v);
  }

  setBrushMode(mode: BrushMode): void {
    this.brushMode.set(mode);
  }

  clearMask(): void {
    this.maskService.clearMask();
  }

  undo(): void {
    this.maskService.undo();
  }

  getBrushCursor(): string {
    if (this.isDraggingPivot()) return 'grabbing';
    // The brush outline is drawn on the overlay canvas in renderOverlay(),
    // which matches the painted mask exactly at any size. The CSS cursor
    // is just a fallback pointer indicator - browsers cap cursor size
    // (~128px) so we can't use it for the brush preview itself.
    return 'crosshair';
  }

  onPointerDown(event: MouseEvent): void {
    // Pivot drag takes priority when circular sort is active.
    if (this.filtersService.filters().circularSort) {
      const piv = this.effectivePivotNormalized();
      if (piv) {
        const c = this.maskCanvasRef.nativeElement;
        const pivPxX = piv.nx * c.offsetWidth;
        const pivPxY = piv.ny * c.offsetHeight;
        const dist = Math.sqrt(
          (event.offsetX - pivPxX) ** 2 + (event.offsetY - pivPxY) ** 2,
        );
        if (dist <= 16) {
          this.isPivotDrag = true;
          this.isDraggingPivot.set(true);
          return;
        }
      }
    }

    this.isDrawing = true;
    const { nx, ny } = this.getNormalized(event.offsetX, event.offsetY);
    this.lastX = nx;
    this.lastY = ny;
    if (event.shiftKey) {
      this.shiftAnchorX = nx;
      this.shiftAnchorY = ny;
      this.shiftLocked.set(null);
    }
    this.maskService.beginStroke();
    this.applyBrush(nx, ny);
  }

  onPointerMove(event: MouseEvent): void {
    // Always track mouse position for the brush outline preview - even when
    // not drawing, so the user sees the brush size/shape on hover.
    this.brushPreviewX = event.offsetX;
    this.brushPreviewY = event.offsetY;

    if (this.isPivotDrag) {
      const { nx, ny } = this.getNormalized(event.offsetX, event.offsetY);
      this.filtersService.setPivot(
        nx * this.maskService.imageWidth,
        ny * this.maskService.imageHeight,
      );
      return;
    }

    if (!this.isDrawing) return;
    let { nx, ny } = this.getNormalized(event.offsetX, event.offsetY);

    if (event.shiftKey) {
      if (this.shiftLocked() === null) {
        this.shiftAnchorX = this.lastX;
        this.shiftAnchorY = this.lastY;
      }
      ({ nx, ny } = this.applyAxisLock(nx, ny));
    } else {
      if (this.shiftLocked() !== null) {
        this.shiftLocked.set(null);
      }
    }

    this.interpolate(this.lastX, this.lastY, nx, ny);
    this.lastX = nx;
    this.lastY = ny;
  }

  onPointerUp(): void {
    if (this.isPivotDrag) {
      this.isPivotDrag = false;
      this.isDraggingPivot.set(false);
      return;
    }
    if (this.isDrawing) {
      this.maskService.endStroke();
    }
    this.isDrawing = false;
    this.shiftLocked.set(null);
  }

  onPointerLeave(): void {
    this.onPointerUp();
    // Clear brush preview when the cursor leaves the canvas so we don't
    // leave a stale outline hovering at the last position.
    this.brushPreviewX = null;
    this.brushPreviewY = null;
  }

  onTouchEnd(): void {
    this.onPointerUp();
    this.brushPreviewX = null;
    this.brushPreviewY = null;
  }

  onTouchStart(event: TouchEvent): void {
    event.preventDefault();
    this.isDrawing = true;
    const { nx, ny } = this.getTouchNormalized(event.touches[0]);
    this.lastX = nx;
    this.lastY = ny;
    const c = this.maskCanvasRef.nativeElement;
    const r = c.getBoundingClientRect();
    this.brushPreviewX = event.touches[0].clientX - r.left;
    this.brushPreviewY = event.touches[0].clientY - r.top;
    this.maskService.beginStroke();
    this.applyBrush(nx, ny);
  }

  onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    if (!this.isDrawing) return;
    const { nx, ny } = this.getTouchNormalized(event.touches[0]);
    const c = this.maskCanvasRef.nativeElement;
    const r = c.getBoundingClientRect();
    this.brushPreviewX = event.touches[0].clientX - r.left;
    this.brushPreviewY = event.touches[0].clientY - r.top;
    this.interpolate(this.lastX, this.lastY, nx, ny);
    this.lastX = nx;
    this.lastY = ny;
  }

  private applyBrush(nx: number, ny: number): void {
    if (this.brushMode() === 'erase') {
      this.maskService.eraseAt(nx, ny);
    } else {
      this.maskService.paintAt(nx, ny);
    }
  }

  private applyAxisLock(nx: number, ny: number): { nx: number; ny: number } {
    const dx = Math.abs(nx - this.shiftAnchorX);
    const dy = Math.abs(ny - this.shiftAnchorY);

    if (this.shiftLocked() === null) {
      if (dx < 0.003 && dy < 0.003) {
        return { nx, ny };
      }
      this.shiftLocked.set(dx >= dy ? 'horizontal' : 'vertical');
    }

    if (this.shiftLocked() === 'horizontal') {
      return { nx, ny: this.shiftAnchorY };
    } else {
      return { nx: this.shiftAnchorX, ny };
    }
  }

  private interpolate(x0: number, y0: number, x1: number, y1: number): void {
    const dist = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
    const steps = Math.max(1, Math.ceil(dist / 0.005));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.applyBrush(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
    }
  }

  private getNormalized(offsetX: number, offsetY: number) {
    const c = this.maskCanvasRef.nativeElement;
    return { nx: offsetX / c.offsetWidth, ny: offsetY / c.offsetHeight };
  }

  private getTouchNormalized(touch: Touch) {
    const c = this.maskCanvasRef.nativeElement;
    const r = c.getBoundingClientRect();
    return {
      nx: (touch.clientX - r.left) / r.width,
      ny: (touch.clientY - r.top) / r.height,
    };
  }

  private resizeCanvas(): void {
    const canvas = this.maskCanvasRef?.nativeElement;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 800;
    canvas.height = canvas.offsetHeight || 600;
  }

  private startRenderLoop(): void {
    const render = () => {
      this.renderOverlay();
      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  private renderOverlay(): void {
    const ctx = this.displayCtx;
    if (!ctx) return;

    const canvas = this.maskCanvasRef.nativeElement;

    if (
      canvas.width !== canvas.offsetWidth ||
      canvas.height !== canvas.offsetHeight
    ) {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Mask overlay (brush strokes). Drawn first so the pivot marker sits
    // on top and stays visible over painted areas.
    const overlayVisible = this.maskService.isOverlayVisible();

    const maskCanvas = this.maskService.getMaskCanvas();
    if (overlayVisible && maskCanvas && this.maskService.hasMask()) {
      const brush = this.maskService.brushSettings();
      ctx.save();
      ctx.globalAlpha = brush.opacity;
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(maskCanvas, 0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = brush.color;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Pivot marker - only when circular sort is active. Drawn on top of the
    // mask so it's always grabbable.
    if (overlayVisible && this.filtersService.filters().circularSort) {
      this.drawPivotMarker(ctx, canvas);
    }

    // Rule-of-thirds grid - purely visual reference. Toggleable via
    // filters.showGrid.
    if (this.filtersService.filters().showGrid) {
      this.drawThirdsGrid(ctx, canvas);
    }

    // Brush outline preview - drawn last so it's always visible on top of
    // mask, pivot, and grid. Uses the SAME formula as paintAt (fraction of
    // min display dim) so it matches the painted mask 1:1 at any size.
    // Suppressed during pivot drag to avoid clutter.
    if (overlayVisible && !this.isDraggingPivot()) {
      this.drawBrushPreview(ctx, canvas);
    }
  }

  /**
   * Draws the brush outline at the current hover position. The radius
   * matches paintAt exactly: `(size/100) * min(canvasW, canvasH) / 2`.
   * For ring shape, draws both outer and inner circles. Dashed outline
   * distinguishes it from the painted mask.
   */
  private drawBrushPreview(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
  ): void {
    if (this.brushPreviewX == null || this.brushPreviewY == null) return;

    const frac = this.maskService.brushDiameterFraction();
    const dispMin = Math.min(canvas.width, canvas.height);
    const outerR = (frac * dispMin) / 2;
    if (outerR <= 0) return;

    const brush = this.maskService.brushSettings();
    const color =
      this.brushMode() === 'erase' ? '255, 183, 77' : '79, 195, 247';

    ctx.save();
    ctx.strokeStyle = `rgba(${color}, 0.9)`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);

    ctx.beginPath();
    ctx.arc(this.brushPreviewX, this.brushPreviewY, outerR, 0, Math.PI * 2);
    ctx.stroke();

    if (brush.shape === 'ring' && brush.hole > 0) {
      const innerR = outerR * brush.hole;
      if (innerR > 0) {
        ctx.beginPath();
        ctx.arc(this.brushPreviewX, this.brushPreviewY, innerR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  /**
   * Draws the classic rule-of-thirds grid: 2 vertical + 2 horizontal lines
   * dividing the canvas into 9 equal regions, plus a small center dot at
   * the image midpoint (useful for aligning with the default pivot).
   * Rendered in CSS pixels so it scales with zoom/resize. Thin
   * semi-transparent white - non-destructive, does not affect mask or sort.
   */
  private drawThirdsGrid(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
  ): void {
    const w = canvas.width;
    const h = canvas.height;
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 3, 0);
    ctx.lineTo(w / 3, h);
    ctx.moveTo((w * 2) / 3, 0);
    ctx.lineTo((w * 2) / 3, h);
    ctx.moveTo(0, h / 3);
    ctx.lineTo(w, h / 3);
    ctx.moveTo(0, (h * 2) / 3);
    ctx.lineTo(w, (h * 2) / 3);
    ctx.stroke();
    // Marks the default pivot location.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /**
   * Returns the effective pivot in normalized [0,1] image coordinates.
   * Resolves `null` (auto-center) to {0.5, 0.5}. Returns null if the image
   * dimensions aren't initialized yet.
   */
  private effectivePivotNormalized(): {
    nx: number;
    ny: number;
  } | null {
    const w = this.maskService.imageWidth;
    const h = this.maskService.imageHeight;
    if (!w || !h) return null;
    const p = this.filtersService.pivot();
    if (p) return { nx: p.x / w, ny: p.y / h };
    return { nx: 0.5, ny: 0.5 };
  }

  private drawPivotMarker(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
  ): void {
    const piv = this.effectivePivotNormalized();
    if (!piv) return;
    const px = piv.nx * canvas.width;
    const py = piv.ny * canvas.height;
    const dragging = this.isDraggingPivot();

    ctx.save();
    ctx.strokeStyle = dragging
      ? 'rgba(255,255,255,1)'
      : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px - 14, py);
    ctx.lineTo(px - 6, py);
    ctx.moveTo(px + 6, py);
    ctx.lineTo(px + 14, py);
    ctx.moveTo(px, py - 14);
    ctx.lineTo(px, py - 6);
    ctx.moveTo(px, py + 6);
    ctx.lineTo(px, py + 14);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
