import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The two-column frame every image tool sits in: a fixed settings panel and
 * the canvas beside it, each scrolling inside itself so reaching a control at
 * the bottom of the panel no longer takes the canvas out of view.
 *
 * `min-h-0` on the flex children is what makes that work. A flex item defaults
 * to `min-height:auto` and refuses to shrink below its content, so
 * `overflow-y-auto` never engages without it, and it fails silently.
 * `overscroll-contain` keeps the panel's end from scrolling the page behind.
 *
 * Only from `lg` up. Below that the columns stack and scrolling the page is
 * the correct behaviour.
 */
@Component({
  selector: 'tool-shell',
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col lg:flex-row gap-0 lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden"
    >
      <aside
        class="w-full lg:w-[260px] shrink-0 border-b lg:border-b-0 lg:border-r border-border p-5 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
        style="background: var(--color-bg-secondary)"
      >
        <h2
          class="text-xs font-semibold text-text-muted uppercase tracking-widest mb-5"
        >
          {{ panelLabel() }}
        </h2>
        <ng-content select="[panel]" />
      </aside>

      <!-- The canvas column. Its own children decide what fills the space,
           which is why the page marks its canvas wrapper flex-1 min-h-0. -->
      <div class="flex-1 flex flex-col min-w-0 lg:min-h-0 lg:overflow-hidden">
        <ng-content />
      </div>
    </div>
  `,
})
export class ToolShellComponent {
  /** The only uppercase text in a panel. */
  panelLabel = input('Controls');
}
