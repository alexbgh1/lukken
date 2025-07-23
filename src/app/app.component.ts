import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NavComponent } from './shared/components/nav/nav.component';
import { ColorPaletteComponent } from './shared/components/color-palette/color-palette.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  title = 'photography';
}
