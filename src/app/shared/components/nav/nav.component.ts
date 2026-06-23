import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { NAV_LINKS } from '../../constants/nav-links.constants';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
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
