import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { cn } from '../../utils/cn';

@Component({
  selector: 'move-icon',
  changeDetection: ChangeDetectionStrategy.Eager,
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
      class="lucide lucide-move-icon lucide-move"
    >
      <path d="M12 2v20" />
      <path d="m15 19-3 3-3-3" />
      <path d="m19 9 3 3-3 3" />
      <path d="M2 12h20" />
      <path d="m5 9-3 3 3 3" />
      <path d="m9 5 3-3 3 3" />
    </svg>
  `,
})
export class MoveIconComponent {
  baseClass: string = 'w-8 h-8 text-text-muted';
  @Input() className: string = '';

  mergedClassList(): string {
    return cn(this.baseClass, this.className);
  }
}
