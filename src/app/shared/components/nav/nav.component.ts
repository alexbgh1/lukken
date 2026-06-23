import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NAV_LINKS } from '@shared/constants/nav-links.constants';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './nav.component.html',
})
export class NavComponent {
  isMenuOpen = false;

  navLinks = NAV_LINKS;

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }
}
