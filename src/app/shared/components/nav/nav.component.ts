import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './nav.component.html',
})
export class NavComponent {
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
      name: '3d nodes',
      href: '/3d-nodes',
    },
  ];
}
