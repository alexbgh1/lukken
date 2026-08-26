import { Injectable, computed, signal } from '@angular/core';
import {
  DEFAULT_HALFTONE_FILTERS,
  HALFTONE_CONFIG,
  HalftoneFilters,
  HalftoneInk,
  HalftoneMode,
  HalftoneShape,
  PROCESS_ANGLES,
} from '../constants/halftone.constants';
import { ZoomLevel } from '@shared/utils/zoom';

/** Numeric controls that a double-click can reset to their default. */
export type HalftoneNumericKey =
  | 'cell'
  | 'angle'
  | 'response'
  | 'dotScale'
  | 'angleC'
  | 'angleM'
  | 'angleY'
  | 'angleK';

@Injectable({
  providedIn: 'root',
})
export class HalftoneFiltersService {
  private _filters = signal<HalftoneFilters>({ ...DEFAULT_HALFTONE_FILTERS });

  // Display-only state: never feeds the render, so changing it is free.
  private _zoom = signal<ZoomLevel>('fit');
  private _effectiveScale = signal(1);

  /**
   * Whether screening follows the controls automatically.
   *
   * This gates the HEAVY pass only. Ink and paper keep updating either way,
   * since recolouring costs a few milliseconds and holding it back behind a
   * button would make the tool feel broken for no gain.
   */
  private _liveChanges = signal(true);

  readonly filters = this._filters.asReadonly();
  readonly zoom = this._zoom.asReadonly();
  readonly effectiveScale = this._effectiveScale.asReadonly();
  readonly liveChanges = this._liveChanges.asReadonly();

  /**
   * Identity of every input the SCREENING pass depends on.
   *
   * Ink and paper are deliberately absent: they only tint a mask that is
   * already built, so recolouring must never pay for a re-screen. `negative`
   * is present because it flips the dot sizes themselves.
   */
  readonly heavyKey = computed(() => {
    const f = this._filters();
    return [
      f.mode,
      f.cell,
      f.angle,
      f.shape,
      f.response,
      f.dotScale,
      f.negative,
      f.angleC,
      f.angleM,
      f.angleY,
      f.angleK,
    ].join('|');
  });

  /** The screens to build for the current mode, each with its own angle. */
  readonly screenPlan = computed<Array<{ ink: HalftoneInk; angle: number }>>(
    () => {
      const f = this._filters();
      if (f.mode === 'mono') {
        return [{ ink: 'ink', angle: f.angle }];
      }
      // Yellow first so the heaviest ink, black, lands on top of the stack.
      return [
        { ink: 'y', angle: f.angleY },
        { ink: 'c', angle: f.angleC },
        { ink: 'm', angle: f.angleM },
        { ink: 'k', angle: f.angleK },
      ];
    },
  );

  updateFilters(partial: Partial<HalftoneFilters>): void {
    this._filters.update((current) => ({ ...current, ...partial }));
  }

  resetFilters(): void {
    this._filters.set({ ...DEFAULT_HALFTONE_FILTERS });
  }

  setMode(mode: HalftoneMode): void {
    this.updateFilters({ mode });
  }

  setShape(shape: HalftoneShape): void {
    this.updateFilters({ shape });
  }

  toggleNegative(): void {
    this._filters.update((c) => ({ ...c, negative: !c.negative }));
  }

  setValue(key: HalftoneNumericKey, value: number): void {
    this.updateFilters({ [key]: value } as Partial<HalftoneFilters>);
  }

  /**
   * Double-click restores the default, matching 3D Nodes and Fractal Glass.
   * Paired with `isModified` it also drives the `slider-modified` thumb.
   */
  resetValue(key: HalftoneNumericKey): void {
    this.setValue(key, DEFAULT_HALFTONE_FILTERS[key]);
  }

  isModified(key: HalftoneNumericKey): boolean {
    return this._filters()[key] !== DEFAULT_HALFTONE_FILTERS[key];
  }

  /** Puts the four screens back on the traditional rosette angles. */
  resetProcessAngles(): void {
    this.updateFilters({
      angleC: PROCESS_ANGLES.c,
      angleM: PROCESS_ANGLES.m,
      angleY: PROCESS_ANGLES.y,
      angleK: PROCESS_ANGLES.k,
    });
  }

  /** True when the four screens sit on the angles that produce a rosette. */
  readonly hasProcessAngles = computed(() => {
    const f = this._filters();
    return (
      f.angleC === PROCESS_ANGLES.c &&
      f.angleM === PROCESS_ANGLES.m &&
      f.angleY === PROCESS_ANGLES.y &&
      f.angleK === PROCESS_ANGLES.k
    );
  });

  setInk(inkColor: string): void {
    this.updateFilters({ inkColor });
  }

  setPaper(paperColor: string): void {
    this.updateFilters({ paperColor });
  }

  applyPreset(ink: string, paper: string): void {
    this.updateFilters({ inkColor: ink, paperColor: paper });
  }

  /** Swaps the two, which is how the reversed print is reached in one click. */
  swapInkAndPaper(): void {
    this._filters.update((c) => ({
      ...c,
      inkColor: c.paperColor,
      paperColor: c.inkColor,
    }));
  }

  // View state.

  setZoom(zoom: ZoomLevel): void {
    this._zoom.set(zoom);
  }

  setEffectiveScale(scale: number): void {
    this._effectiveScale.set(scale);
  }

  setLiveChanges(live: boolean): void {
    this._liveChanges.set(live);
  }

  /** Lattice spacing rescaled for a pass running at a different resolution. */
  cellForWidth(workingWidth: number, targetWidth: number): number {
    const scaled = (this._filters().cell * targetWidth) / workingWidth;
    return Math.max(HALFTONE_CONFIG.CELL.MIN, scaled);
  }
}
