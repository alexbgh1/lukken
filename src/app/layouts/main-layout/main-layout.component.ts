import { Component, Input } from '@angular/core';

@Component({
  imports: [],
  selector: 'main-layout',
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent {
  @Input() className: string = '';
}
