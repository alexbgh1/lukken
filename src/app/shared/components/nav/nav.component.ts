import {
  Component,
  ChangeDetectionStrategy,
  HostListener,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NAV_LINKS } from '@shared/constants/nav-links.constants';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nav.component.html',
})
export class NavComponent {
  private _isMenuOpen = signal(false);
  readonly isMenuOpen = this._isMenuOpen.asReadonly();

  navLinks = NAV_LINKS;

  toggleMenu(): void {
    this._isMenuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this._isMenuOpen.set(false);
  }

  /** Escape is the expected way out of an open overlay. */
  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeMenu();
  }

  /** Leaving the mobile breakpoint should not strand an open panel. */
  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth >= 640) this.closeMenu();
  }
}
