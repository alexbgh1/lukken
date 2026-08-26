import { Injectable, signal } from '@angular/core';
import {
  CanvasFilters,
  NodeMetrics,
} from '@interfaces/three-d-nodes-filters.interface';
import { ImageSlot } from '@shared/utils/image-slot';

@Injectable({
  providedIn: 'root',
})
export class FiltersDataService {
  /** Survives navigation, so the sidebar preview persists across routes. */
  readonly imageSlot = new ImageSlot();

  private filtersSignal = signal<CanvasFilters | null>(null);
  currentFilters = this.filtersSignal.asReadonly();

  private metricsSignal = signal<NodeMetrics | null>(null);
  nodeMetrics = this.metricsSignal.asReadonly();

  private interactiveSignal = signal(false);
  interactive = this.interactiveSignal.asReadonly();

  /**
   * Whether the scene is being rebuilt. Owned here rather than in the canvas
   * component so the page header can show it without reaching into the child.
   */
  private processingSignal = signal(false);
  isProcessing = this.processingSignal.asReadonly();

  setProcessing(value: boolean): void {
    this.processingSignal.set(value);
  }

  /** Set when the chosen file could not be decoded. */
  private loadErrorSignal = signal<string | null>(null);
  loadError = this.loadErrorSignal.asReadonly();

  setLoadError(message: string | null): void {
    this.loadErrorSignal.set(message);
  }

  updateFilters(filters: CanvasFilters): void {
    this.filtersSignal.set(filters);
  }

  updateNodeMetrics(metrics: NodeMetrics): void {
    this.metricsSignal.set(metrics);
  }

  updateInteractive(value: boolean): void {
    this.interactiveSignal.set(value);
  }
}
