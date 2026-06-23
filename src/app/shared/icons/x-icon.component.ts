import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { cn } from '../utils/cn';

@Component({
  selector: 'x-icon',
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
      class="lucide lucide-x-icon lucide-x"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  `,
})
export class XIconComponent {
  baseClass: string = 'w-8 h-8 text-text-muted';
  @Input() className: string = '';

  mergedClassList(): string {
    return cn(this.baseClass, this.className);
  }
}
