import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './nav.component.html',
})
export class NavComponent {
  isMenuOpen = false;

  navLinks = [
    {
      name: 'Home',
      href: '/',
    },
    {
      name: 'Dead Pixels',
      href: '/dead-pixels',
    },
    {
      name: 'Pixel Sort',
      href: '/pixel-sort',
    },
    {
      name: '3D Nodes',
      href: '/3d-nodes',
    },
  ];

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu(): void {
    this.isMenuOpen = false;
  }
}
