import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ZOOM_LEVELS, ZoomLevel } from '@shared/utils/zoom';

/**
 * The Fit / 50% / 100% / 200% selector shown in a tool's toolbar.
 *
 * Presentational: the level lives on the page's service so it survives
 * navigation, and the page decides what to do with it.
 */
@Component({
  selector: 'zoom-control',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-1">
      @for (level of levels; track level.label) {
        <button
          type="button"
          (click)="zoomChange.emit(level.value)"
          class="px-2 py-1 text-2xs font-medium rounded transition-colors duration-200 border"
          [class]="
            level.value === zoom()
              ? 'bg-accent-primary text-bg-primary border-accent-primary'
              : 'bg-transparent border-border text-text-secondary hover:bg-hover'
          "
        >
          {{ level.label }}
        </button>
      }
    </div>
  `,
})
export class ZoomControlComponent {
  levels = ZOOM_LEVELS;

  zoom = input.required<ZoomLevel>();
  zoomChange = output<ZoomLevel>();
}
