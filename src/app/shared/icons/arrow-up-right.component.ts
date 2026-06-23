import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { cn } from '../utils/cn';

@Component({
  selector: 'arrow-up-right-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [class]="mergedClassList()"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="lucide lucide-arrow-up-right-icon lucide-arrow-up-right"
    >
      <path d="M7 7h10v10" />
      <path d="M7 17 17 7" />
    </svg>
  `,
})
export class ArrowUpRightIconComponent {
  baseClass: string = 'w-8 h-8 text-text-muted';
  @Input() className: string = '';

  mergedClassList(): string {
    return cn(this.baseClass, this.className);
  }
}
