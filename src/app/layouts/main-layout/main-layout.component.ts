import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { cn } from '@shared/utils/cn';

@Component({
  imports: [],
  selector: 'main-layout',
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './main-layout.component.html',
})
export class MainLayoutComponent {
  baseClass =
    'flex p-8 pt-24 md:pt-32 md:p-20 flex-col max-w-6xl mx-auto min-h-[500px]';
  @Input() className: string = '';

  mergedClassList(): string {
    return cn(this.baseClass, this.className);
  }
}
