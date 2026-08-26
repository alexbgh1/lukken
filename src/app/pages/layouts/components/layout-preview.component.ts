import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
} from '@angular/core';
import { SlotUploadComponent } from './slot-upload.component';
import { LayoutPattern, LayoutFormat } from '../interfaces/layout.interface';
import { LAYOUT_PATTERNS, insetSlotRect } from '../constants/layouts.constants';

interface SlotRectStyle {
  left: string;
  top: string;
  width: string;
  height: string;
  compact: boolean;
}

@Component({
  selector: 'layout-preview',
  standalone: true,
  imports: [SlotUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative w-full rounded-lg overflow-hidden"
      [class.bg-white]="allUploaded()"
      [style.aspect-ratio]="aspect()"
    >
      @for (rect of slotRects(); track $index; let i = $index) {
        <div
          class="absolute"
          [style.left]="rect.left"
          [style.top]="rect.top"
          [style.width]="rect.width"
          [style.height]="rect.height"
        >
          <slot-upload
            [label]="labels()[i]"
            [previewUrl]="previews()[i] ?? null"
            [hasImage]="previews()[i] != null"
            [fileName]="fileNames()[i] ?? ''"
            [compact]="rect.compact"
            (fileSelected)="fileSelected.emit({ index: i, file: $event })"
          />
        </div>
      }
    </div>
  `,
})
export class LayoutPreviewComponent {
  pattern = input.required<LayoutPattern>();
  format = input.required<LayoutFormat>();
  previews = input.required<(string | null)[]>();
  fileNames = input.required<string[]>();
  labels = input.required<string[]>();
  gap = input(0);

  fileSelected = output<{ index: number; file: File }>();

  allUploaded = computed(() => {
    const p = this.previews();
    return p.length > 0 && p.every((url) => url != null);
  });

  aspect = computed(() => {
    const [cw, ch] = LAYOUT_PATTERNS[this.pattern()][this.format()].canvas;
    return `${cw} / ${ch}`;
  });

  slotRects = computed<SlotRectStyle[]>(() => {
    const variant = LAYOUT_PATTERNS[this.pattern()][this.format()];
    const [cw, ch] = variant.canvas;
    return variant.slots.map((s) => {
      const r = insetSlotRect(s, variant, this.gap());
      return {
        left: `${(r.x / cw) * 100}%`,
        top: `${(r.y / ch) * 100}%`,
        width: `${(r.w / cw) * 100}%`,
        height: `${(r.h / ch) * 100}%`,
        compact: (s.w * s.h) / (cw * ch) < 0.15,
      };
    });
  });
}
