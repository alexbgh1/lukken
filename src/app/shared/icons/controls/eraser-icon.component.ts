import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { cn } from '../../utils/cn';

@Component({
  selector: 'eraser-icon',
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
      class="lucide lucide-eraser"
    >
      <path
        d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"
      />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  `,
})
export class EraserIconComponent {
  baseClass: string = 'w-8 h-8 text-text-muted';
  @Input() className: string = '';

  mergedClassList(): string {
    return cn(this.baseClass, this.className);
  }
}
