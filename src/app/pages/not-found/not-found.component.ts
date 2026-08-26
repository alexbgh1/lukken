import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { NAV_LINKS } from '@shared/constants';

/**
 * Shown for any address that matches no route.
 *
 * The wildcard used to redirect to the landing, which quietly rewrote the URL
 * and left the visitor wondering whether they had mistyped or the tool had
 * been removed. This keeps the address and says what happened.
 *
 * On GitHub Pages the deploy job copies index.html to 404.html, so an unknown
 * path is served this same application with a real 404 status and the router
 * lands here.
 */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- pt-24 rather than pt-14: the nav is fixed, and in its mobile form it
         is 77px tall, so the 56px the tool pages use would slide the 404 in
         underneath it on a narrow screen. -->
    <main
      class="min-h-screen pt-24 pb-12 flex items-center justify-center px-6 bg-bg-primary text-text-primary"
    >
      <div class="max-w-md w-full text-center">
        <p
          class="text-6xl md:text-7xl font-bold text-text-muted/30 tabular-nums mb-4"
          aria-hidden="true"
        >
          404
        </p>

        <h1 class="text-2xl font-semibold tracking-wide mb-2">Page not found</h1>

        <p class="text-sm text-text-secondary font-normal mb-8">
          That address does not match any tool. It may have moved, or the link
          may be incomplete.
        </p>

        <a
          routerLink="/"
          class="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium tracking-wider bg-accent-primary text-bg-primary transition-[filter,scale] duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          Back to the start
        </a>

        <div class="mt-10 pt-6 border-t border-border">
          <h2
            class="text-2xs font-semibold text-text-muted uppercase tracking-widest mb-4"
          >
            Or open a tool
          </h2>
          <ul class="flex flex-wrap justify-center gap-2">
            @for (tool of tools; track tool.id) {
              <li>
                <a
                  [routerLink]="tool.href"
                  class="inline-flex px-3 py-1.5 rounded-md border border-border text-xs font-medium tracking-wider text-text-secondary hover:bg-hover active:bg-active active:text-bg-primary transition-colors duration-200"
                >
                  {{ tool.name }}
                </a>
              </li>
            }
          </ul>
        </div>
      </div>
    </main>
  `,
})
export class NotFoundComponent {
  /** The nav's own list, minus Home, which the button above already covers. */
  tools = NAV_LINKS.filter((link) => link.href !== '/');
}
