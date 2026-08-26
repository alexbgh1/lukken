import {
  Component,
  ChangeDetectionStrategy,
  computed,
  ElementRef,
  HostListener,
  effect,
  viewChild,
} from '@angular/core';
import {
  GLASS_CONFIG,
  GlassPoint,
  GlassPolygon,
  GlassRect,
} from '../constants/glass.constants';
import { CanvasStageComponent } from '@shared/components/canvas-stage/canvas-stage.component';
import { zoomStyles } from '@shared/utils/zoom';
import { GlassCanvasService } from '../services/canvas.service';
import { GlassFiltersService } from '../services/filters.service';

/** Rectangle handles resize the box; polygon handles move one corner freely. */
type RectHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
/** `v` + index, so the count is not baked into the type. */
type VertexHandle = `v${number}`;
type DragMode = 'move' | RectHandle | VertexHandle;

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  originRect: GlassRect | null;
  originPolygon: GlassPolygon | null;
}

@Component({
  selector: 'glass-canvas',
  imports: [CanvasStageComponent],
  styles: [
    `
      /* Passes the height down from the page frame to the stage. The chain
         only resolves if every link declares one. */
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- The canvas keeps its full pixel data; only the CSS box changes, so
         nothing here affects export quality. -->
    <canvas-stage (resized)="reportScale()">
      <canvas
        #stage
        class="block"
        [class.cursor-crosshair]="isMasked()"
        [style.width]="styles().width"
        [style.height]="styles().height"
        [style.maxWidth]="styles().maxWidth"
        [style.maxHeight]="styles().maxHeight"
        (pointerdown)="onPointerDown($event)"
        (pointermove)="onPointerMove($event)"
        (pointerup)="onPointerUp($event)"
        (pointercancel)="onPointerUp($event)"
        (dblclick)="onDoubleClick($event)"
        style="touch-action: none"
      ></canvas>
    </canvas-stage>
  `,
})
export class GlassCanvasComponent {
  private stage = viewChild<ElementRef<HTMLCanvasElement>>('stage');
  private drag: DragState | null = null;

  constructor(
    private canvasService: GlassCanvasService,
    private filtersService: GlassFiltersService,
  ) {
    // Repaint whenever the layer is rebuilt or a compositing-only setting
    // changes. Reading these signals is what registers the dependency.
    effect(() => {
      this.canvasService.layerVersion();
      this.filtersService.rect();
      this.filtersService.polygon();
      const f = this.filtersService.filters();
      void f.maskMode;
      void f.feather;
      this.filtersService.zoom();
      this.filtersService.maskOverlayVisible();
      this.redraw();
      // Layout settles after this tick; measure then.
      queueMicrotask(() => this.reportScale());
    });
  }

  // ── mode helpers ──

  private maskMode(): string {
    return this.filtersService.filters().maskMode;
  }

  /** True for any mode that draws an editable region. */
  isMasked(): boolean {
    return this.maskMode() !== 'full';
  }

  private isPolygonMode(): boolean {
    return this.maskMode() === 'polygon';
  }

  /**
   * CSS box for the current zoom level. Never affects the pixel data.
   *
   * Measured against the SOURCE image, not the working canvas, so that a given
   * zoom level means the same on-screen size in every tool. See the Halftone
   * canvas for the full reasoning.
   */
  styles = computed(() => {
    const size =
      this.canvasService.sourceSize() ?? this.canvasService.imageSize();
    return zoomStyles(
      this.filtersService.zoom(),
      size?.width ?? null,
      size?.height ?? null,
    );
  });

  /** Reports the scale actually on screen, against the source dimensions. */
  reportScale(): void {
    const canvas = this.stage()?.nativeElement;
    if (!canvas || !canvas.width) return;
    const source = this.canvasService.sourceSize();
    const reference = source?.width ?? canvas.width;
    const shown = canvas.getBoundingClientRect().width;
    if (shown > 0) {
      this.filtersService.setEffectiveScale(shown / reference);
    }
  }

  // ── painting ──

  private redraw(): void {
    const canvas = this.stage()?.nativeElement;
    if (!canvas || !this.canvasService.hasImage()) return;

    this.canvasService.composite(canvas);
    // The composite alone is the finished result; the frame is editing chrome,
    // so hiding it shows exactly what will be exported.
    if (this.isMasked() && this.filtersService.maskOverlayVisible()) {
      this.drawOverlay(canvas);
    }
  }

  private drawOverlay(canvas: HTMLCanvasElement): void {
    const points = this.handlePoints();
    if (!points.length) return;

    const ctx = canvas.getContext('2d')!;
    const size = this.handleSize();

    ctx.save();
    ctx.strokeStyle = '#4da3ff';
    ctx.lineWidth = Math.max(1.5, size * 0.2);

    // Outline follows the region itself, so a tilted shape reads correctly.
    if (this.isPolygonMode()) {
      const polygon = this.filtersService.polygon();
      if (polygon?.length) {
        ctx.beginPath();
        ctx.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < polygon.length; i++) {
          ctx.lineTo(polygon[i].x, polygon[i].y);
        }
        ctx.closePath();
        ctx.stroke();
      }
    } else {
      const rect = this.filtersService.rect();
      if (rect) ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    }

    ctx.fillStyle = '#ffffff';
    for (const [hx, hy] of points) {
      ctx.beginPath();
      ctx.rect(hx - size / 2, hy - size / 2, size, size);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Handle size in image pixels, so it looks constant on screen. */
  private handleSize(): number {
    const canvas = this.stage()?.nativeElement;
    if (!canvas) return GLASS_CONFIG.CANVAS.HANDLE_SIZE;
    const displayed = canvas.getBoundingClientRect().width || canvas.width;
    return GLASS_CONFIG.CANVAS.HANDLE_SIZE * (canvas.width / displayed);
  }

  /** Same conversion as handles, so edge hits scale with zoom too. */
  private edgeTolerance(): number {
    const canvas = this.stage()?.nativeElement;
    if (!canvas) return GLASS_CONFIG.CANVAS.EDGE_HIT_TOLERANCE;
    const displayed = canvas.getBoundingClientRect().width || canvas.width;
    return GLASS_CONFIG.CANVAS.EDGE_HIT_TOLERANCE * (canvas.width / displayed);
  }

  /**
   * Rectangle exposes eight handles (corners plus edge midpoints); polygon
   * exposes one per corner, however many there are.
   */
  private handlePoints(): Array<[number, number, DragMode]> {
    if (this.isPolygonMode()) {
      const polygon = this.filtersService.polygon();
      if (!polygon) return [];
      return polygon.map(
        (p, i) =>
          [p.x, p.y, `v${i}` as VertexHandle] as [number, number, DragMode],
      );
    }

    const rect = this.filtersService.rect();
    if (!rect) return [];
    const { x, y, w, h } = rect;
    return [
      [x, y, 'nw'],
      [x + w / 2, y, 'n'],
      [x + w, y, 'ne'],
      [x + w, y + h / 2, 'e'],
      [x + w, y + h, 'se'],
      [x + w / 2, y + h, 's'],
      [x, y + h, 'sw'],
      [x, y + h / 2, 'w'],
    ];
  }

  // ── hit testing ──

  /** Maps a pointer event to image-space coordinates. */
  private toImageSpace(e: MouseEvent): GlassPoint {
    const canvas = this.stage()!.nativeElement;
    const box = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - box.left) * (canvas.width / box.width),
      y: (e.clientY - box.top) * (canvas.height / box.height),
    };
  }

  private hitHandle(px: number, py: number): DragMode | null {
    const tolerance = this.handleSize() * 1.2;
    for (const [hx, hy, mode] of this.handlePoints()) {
      if (Math.abs(px - hx) <= tolerance && Math.abs(py - hy) <= tolerance) {
        return mode;
      }
    }
    return null;
  }

  /**
   * Closest point on the segment a-b, clamped to its ends, plus the distance
   * to it. Used to decide which edge a double-click landed on.
   */
  private projectOnSegment(
    p: GlassPoint,
    a: GlassPoint,
    b: GlassPoint,
  ): { point: GlassPoint; distance: number } {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const lengthSq = vx * vx + vy * vy;
    if (lengthSq === 0) {
      return { point: { ...a }, distance: Math.hypot(p.x - a.x, p.y - a.y) };
    }
    let t = ((p.x - a.x) * vx + (p.y - a.y) * vy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const point = { x: a.x + t * vx, y: a.y + t * vy };
    return { point, distance: Math.hypot(p.x - point.x, p.y - point.y) };
  }

  /** Index of the edge nearest to `p`, identified by the corner it ends at. */
  private hitEdge(
    p: GlassPoint,
    polygon: GlassPolygon,
  ): { insertAt: number; point: GlassPoint } | null {
    const tolerance = this.edgeTolerance();
    let best: { insertAt: number; point: GlassPoint; distance: number } | null =
      null;

    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const hit = this.projectOnSegment(p, a, b);
      if (
        hit.distance <= tolerance &&
        (!best || hit.distance < best.distance)
      ) {
        best = { insertAt: i + 1, point: hit.point, distance: hit.distance };
      }
    }

    return best ? { insertAt: best.insertAt, point: best.point } : null;
  }

  private insideRegion(px: number, py: number): boolean {
    if (this.isPolygonMode()) {
      const polygon = this.filtersService.polygon();
      return polygon ? this.insidePolygon(px, py, polygon) : false;
    }
    const r = this.filtersService.rect();
    return r
      ? px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
      : false;
  }

  /** Ray casting - also handles the self-intersecting shapes we allow. */
  private insidePolygon(
    px: number,
    py: number,
    polygon: GlassPolygon,
  ): boolean {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const { x: xi, y: yi } = polygon[i];
      const { x: xj, y: yj } = polygon[j];
      const straddles = yi > py !== yj > py;
      if (straddles && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  // ── adding and removing corners ──

  /**
   * One verb for both operations: double-click a corner to drop it, or an edge
   * to add one there. The corner is tested first so a click that is near both
   * removes rather than inserts.
   */
  onDoubleClick(e: MouseEvent): void {
    if (!this.isPolygonMode() || !this.canvasService.hasImage()) return;
    const polygon = this.filtersService.polygon();
    if (!polygon) return;

    const p = this.toImageSpace(e);
    e.preventDefault();

    const handle = this.hitHandle(p.x, p.y);
    if (handle && handle !== 'move') {
      this.filtersService.removePoint(Number(handle.slice(1)));
      return;
    }

    const edge = this.hitEdge(p, polygon);
    if (edge) this.filtersService.insertPoint(edge.insertAt, edge.point);
  }

  // ── dragging ──

  onPointerDown(e: PointerEvent): void {
    if (!this.isMasked() || !this.canvasService.hasImage()) return;

    const p = this.toImageSpace(e);
    const handle = this.hitHandle(p.x, p.y);
    const mode: DragMode | null =
      handle ?? (this.insideRegion(p.x, p.y) ? 'move' : null);
    if (!mode) return;

    const polygon = this.filtersService.polygon();
    const rect = this.filtersService.rect();
    this.drag = {
      mode,
      startX: p.x,
      startY: p.y,
      originRect: rect ? { ...rect } : null,
      originPolygon: polygon ? polygon.map((q) => ({ ...q })) : null,
    };

    // Capture keeps the drag alive if the pointer leaves the canvas. It throws
    // when the pointer is already gone, which must not abort the drag itself.
    try {
      (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released - dragging still works without capture */
    }
  }

  onPointerMove(e: PointerEvent): void {
    if (!this.isMasked() || !this.canvasService.hasImage()) return;
    const canvas = this.stage()?.nativeElement;
    if (!canvas) return;

    const p = this.toImageSpace(e);

    if (!this.drag) {
      const handle = this.hitHandle(p.x, p.y);
      canvas.style.cursor = handle
        ? this.cursorFor(handle)
        : this.insideRegion(p.x, p.y)
          ? 'move'
          : 'crosshair';
      return;
    }

    const dx = p.x - this.drag.startX;
    const dy = p.y - this.drag.startY;

    if (this.isPolygonMode()) {
      this.dragPolygon(dx, dy, canvas);
    } else {
      this.dragRect(dx, dy, canvas);
    }
  }

  /** Free corners: a vertex goes exactly where it is dropped. */
  private dragPolygon(dx: number, dy: number, canvas: HTMLCanvasElement): void {
    const origin = this.drag?.originPolygon;
    if (!origin) return;

    const mode = this.drag!.mode;
    let next: GlassPolygon;

    if (mode === 'move') {
      next = origin.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
      // Shift the whole shape only as far as its own bounds allow, so moving
      // never silently deforms it against the edge.
      const xs = next.map((pt) => pt.x);
      const ys = next.map((pt) => pt.y);
      const adjustX =
        Math.min(...xs) < 0
          ? -Math.min(...xs)
          : Math.max(...xs) > canvas.width
            ? canvas.width - Math.max(...xs)
            : 0;
      const adjustY =
        Math.min(...ys) < 0
          ? -Math.min(...ys)
          : Math.max(...ys) > canvas.height
            ? canvas.height - Math.max(...ys)
            : 0;
      next = next.map((pt) => ({ x: pt.x + adjustX, y: pt.y + adjustY }));
    } else {
      const index = Number(mode.slice(1));
      next = origin.map((pt, i) =>
        i === index ? { x: pt.x + dx, y: pt.y + dy } : { ...pt },
      );
    }

    this.filtersService.setPolygon(
      this.filtersService.clampPolygon(next, canvas.width, canvas.height),
    );
  }

  private dragRect(dx: number, dy: number, canvas: HTMLCanvasElement): void {
    const o = this.drag?.originRect;
    if (!o) return;

    const next: GlassRect = { ...o };
    const mode = this.drag!.mode;

    if (mode === 'move') {
      next.x = o.x + dx;
      next.y = o.y + dy;
    } else {
      if (mode.includes('w')) {
        next.x = o.x + dx;
        next.w = o.w - dx;
      }
      if (mode.includes('e')) next.w = o.w + dx;
      if (mode.includes('n')) {
        next.y = o.y + dy;
        next.h = o.h - dy;
      }
      if (mode.includes('s')) next.h = o.h + dy;

      // Dragging a side past its opposite edge would invert the rect.
      const min = GLASS_CONFIG.CANVAS.MIN_RECT_SIZE;
      if (next.w < min) {
        if (mode.includes('w')) next.x = o.x + o.w - min;
        next.w = min;
      }
      if (next.h < min) {
        if (mode.includes('n')) next.y = o.y + o.h - min;
        next.h = min;
      }
    }

    this.filtersService.setRect(
      this.filtersService.clampRect(next, canvas.width, canvas.height),
    );
  }

  onPointerUp(e: PointerEvent): void {
    if (this.drag) {
      try {
        (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
      } catch {
        /* capture was never acquired */
      }
      this.drag = null;
    }
  }

  // ── keyboard ──

  /**
   * Hold space to peek at the clean result. Ignored while typing so the key
   * still works normally in the sidebar's inputs.
   */
  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.code !== 'Space' || event.repeat) return;
    if (this.isTypingTarget(event.target)) return;
    if (!this.isMasked()) return;
    event.preventDefault();
    this.filtersService.setPeeking(true);
  }

  @HostListener('document:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if (event.code !== 'Space') return;
    this.filtersService.setPeeking(false);
  }

  /** Releases the peek if focus leaves the tab mid-hold. */
  @HostListener('window:blur')
  onWindowBlur(): void {
    this.filtersService.setPeeking(false);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  private cursorFor(mode: DragMode): string {
    // Polygon corners move freely, so no directional resize cursor applies.
    if (mode.startsWith('v')) return 'grab';
    switch (mode) {
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      default:
        return 'move';
    }
  }
}
