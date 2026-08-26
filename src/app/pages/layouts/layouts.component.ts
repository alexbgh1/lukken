import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MainLayoutComponent } from '../../layouts/main-layout/main-layout.component';
import { LayoutGeneratorComponent } from './components/layout-generator.component';

@Component({
  selector: 'app-layouts',
  standalone: true,
  imports: [MainLayoutComponent, LayoutGeneratorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main-layout className="max-w-none mx-0 p-0 pt-14">
      <layout-generator />
    </main-layout>
  `,
})
export class LayoutsComponent {}
