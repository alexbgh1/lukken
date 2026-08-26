import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

/** Inner box of the stage frame, in CSS pixels. */
export interface StageSize {
  width: number;
  height: number;
}

/**
 * The fixed frame an image is displayed inside. Without it a tall photo grows
 * until it pushes the rest of the page off screen. The frame bounds the
 * height, letterboxes against the canvas background, and scrolls internally
 * once the content is zoomed past it.
 *
 * The height fills whatever `tool-shell` leaves over rather than guessing at
 * it with viewport arithmetic, which goes stale the moment the nav or toolbar
 * changes. Below `lg` the shell releases its height, so the frame falls back
 * to a viewport fraction.
 *
 * Centring uses margin auto on the projected child, because flex centring
 * clips the top and left of an overflowing child.
 */
@Component({
  selector: 'canvas-stage',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #frame class="flex overflow-auto w-full h-[70vh] lg:h-full">
      <ng-content />
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }

      :host ::ng-deep > div > * {
        margin: auto;
        /* Zoomed past the frame the content must overflow and scroll, never
           be squeezed. A canvas resists this on its own because it is a
           replaced element and its automatic minimum size is its intrinsic
           width, but a plain wrapper has no such floor and gets shrunk on the
           horizontal axis only, which quietly distorts the aspect ratio. */
        flex-shrink: 0;
      }
    `,
  ],
})
export class CanvasStageComponent {
  /** Fires whenever the frame is resized, so callers can remeasure scale. */
  resized = output<void>();

  private _size = signal<StageSize>({ width: 0, height: 0 });

  /**
   * The frame's inner box, in CSS pixels.
   *
   * Published for the tools whose media is not a direct child of the frame.
   * Those cannot fit with `max-height: 100%`, because the percentage resolves
   * against the wrapper in between, which has an auto height, so the rule is
   * dropped and the image renders full size. Given this size they can compute
   * the fitted box outright instead.
   *
   * Measured from the CLIENT box, which already excludes any scrollbar.
   */
  readonly size = this._size.asReadonly();

  private frame = viewChild<ElementRef<HTMLDivElement>>('frame');
  private observer: ResizeObserver | null = null;

  constructor() {
    afterNextRender(() => {
      const el = this.frame()?.nativeElement;
      if (!el) return;
      this.measure(el);
      this.observer = new ResizeObserver(() => {
        this.measure(el);
        this.resized.emit();
      });
      this.observer.observe(el);
    });

    inject(DestroyRef).onDestroy(() => this.observer?.disconnect());
  }

  private measure(el: HTMLElement): void {
    const width = el.clientWidth;
    const height = el.clientHeight;
    const current = this._size();
    if (current.width !== width || current.height !== height) {
      this._size.set({ width, height });
    }
  }
}
