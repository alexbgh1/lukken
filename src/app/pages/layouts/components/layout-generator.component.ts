import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LayoutPreviewComponent } from './layout-preview.component';
import {
  SlotImage,
  LayoutPattern,
  LayoutFormat,
  LayoutResult,
} from '../interfaces/layout.interface';
import {
  LAYOUT_PATTERNS,
  GAP_OPTIONS,
  DEFAULT_GAP,
} from '../constants/layouts.constants';
import { LayoutsService } from '../services/layouts.service';
import { ToolShellComponent } from '@shared/components/tool-shell/tool-shell.component';

interface PatternOption {
  value: LayoutPattern;
  label: string;
  slots: number;
  labels: string[];
}

const PATTERN_OPTIONS: PatternOption[] = [
  {
    value: 'hero+2',
    label: 'Hero + 2',
    slots: 3,
    labels: ['Hero', 'Second', 'Third'],
  },
  {
    value: 'split_half',
    label: 'Split Half',
    slots: 2,
    labels: ['First', 'Second'],
  },
  {
    value: 'hero_plus_3',
    label: 'Hero + 3',
    slots: 4,
    labels: ['Hero', 'Thumb 1', 'Thumb 2', 'Thumb 3'],
  },
  {
    value: 'grid_2x2',
    label: '2×2 Grid',
    slots: 4,
    labels: ['First', 'Second', 'Third', 'Fourth'],
  },
];

interface ThumbRect {
  left: string;
  top: string;
  width: string;
  height: string;
}

const PATTERN_THUMBS = Object.fromEntries(
  PATTERN_OPTIONS.map((opt) => {
    const variant = LAYOUT_PATTERNS[opt.value]['4:3'];
    const [cw, ch] = variant.canvas;
    return [
      opt.value,
      variant.slots.map((s) => ({
        left: `${(s.x / cw) * 100}%`,
        top: `${(s.y / ch) * 100}%`,
        width: `${(s.w / cw) * 100}%`,
        height: `${(s.h / ch) * 100}%`,
      })),
    ];
  }),
) as Record<LayoutPattern, ThumbRect[]>;

@Component({
  selector: 'layout-generator',
  standalone: true,
  imports: [FormsModule, LayoutPreviewComponent, ToolShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tool-shell>
      <div panel>
        <!-- Pattern -->
        <div class="space-y-2">
          <label class="block text-xs font-medium text-text-secondary">
            Pattern
          </label>
          <div class="grid grid-cols-2 gap-2">
            @for (opt of patternOptions; track opt.value) {
              <button
                type="button"
                (click)="onPatternChange(opt.value)"
                class="flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors cursor-pointer"
                [class]="
                  selectedPattern() === opt.value
                    ? 'border-accent-primary bg-accent-primary/5'
                    : 'border-border hover:bg-hover'
                "
              >
                <div class="relative w-full aspect-[4/3]">
                  @for (rect of patternThumbs[opt.value]; track $index) {
                    <div
                      class="absolute rounded-[2px] bg-clip-padding border border-transparent"
                      [class]="
                        selectedPattern() === opt.value
                          ? 'bg-accent-primary'
                          : 'bg-text-muted'
                      "
                      [style.left]="rect.left"
                      [style.top]="rect.top"
                      [style.width]="rect.width"
                      [style.height]="rect.height"
                    ></div>
                  }
                </div>
                <span
                  class="text-2xs"
                  [class]="
                    selectedPattern() === opt.value
                      ? 'text-text-primary'
                      : 'text-text-secondary'
                  "
                  >{{ opt.label }}</span
                >
              </button>
            }
          </div>
        </div>

        <div class="border-t border-border my-4"></div>

        <!-- Gap Size -->
        <div class="space-y-2">
          <label class="block text-xs font-medium text-text-secondary">
            Gap Size
          </label>
          <div class="grid grid-cols-4 gap-1.5">
            @for (g of gapOptions; track g) {
              <button
                type="button"
                (click)="gapSize.set(g)"
                class="px-1 py-1.5 text-xs font-medium rounded transition-colors duration-200 border"
                [class]="
                  gapSize() === g
                    ? 'bg-accent-primary text-bg-primary border-accent-primary'
                    : 'border-border text-text-secondary hover:bg-hover'
                "
              >
                {{ g === 0 ? 'None' : g + 'px' }}
              </button>
            }
          </div>
        </div>

        <div class="border-t border-border my-4"></div>

        <!-- Quality -->
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            [ngModel]="maxQuality()"
            (ngModelChange)="maxQuality.set($event)"
            class="w-4 h-4 rounded border-border accent-accent-primary"
          />
          <span class="text-sm text-text-secondary">Max Quality</span>
        </label>
        <p class="text-3xs text-text-muted/50 mt-1 pl-6">Auto-scales output</p>

        <div class="border-t border-border my-4"></div>

        <button
          class="w-full py-2.5 px-4 rounded-lg bg-bg-primary border border-border text-text-primary font-medium text-sm hover:bg-hover active:bg-active active:text-bg-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
          [disabled]="isGenerating() || !canGenerate"
          (click)="generate()"
        >
          @if (isGenerating()) {
            Generating...
          } @else {
            Generate Layouts
          }
        </button>
      </div>

      <!-- Header -->
      <div class="px-6 pt-5 pb-3">
        <h1 class="text-xl mb-1 font-semibold tracking-wide">
          Layout Generator
        </h1>
        <p class="text-sm text-text-secondary max-w-xl font-normal">
          Compose several photos into one frame, in 4:3 and 3:4 at once. Fill
          each slot, then download the crops on their own or the whole set as a
          bundle.
        </p>
      </div>

      <div class="flex-1 min-h-0 flex flex-col px-6 pb-4 gap-6 overflow-y-auto">
        <!-- Mockups. With no canvas to look at, the drop targets are
             the interface, so their size is usability.

             Width leads. The two frames split the row 16 to 9, the ratio
             of their aspects, so their heights match without being told
             to, and a box sized from a definite width cannot overflow its
             container. Driving from the height instead overlaps them on
             desktop and runs them off the edge on a phone.

             The 1200px cap stops them growing on a large display, and the
             row never shrinks below its content, which would push them
             over the results. Centred only while nothing competes for it. -->
        <div
          class="shrink-0 w-full max-w-[1200px] mx-auto flex flex-wrap gap-8 items-start justify-center"
          [class.my-auto]="results().length === 0"
        >
          @for (fmt of formats; track fmt) {
            <div
              class="flex flex-col items-center gap-1.5 basis-full min-w-0"
              [class]="fmt === '4:3' ? 'lg:flex-[16]' : 'lg:flex-[9]'"
            >
              <div class="w-full">
                <layout-preview
                  [pattern]="selectedPattern()"
                  [format]="fmt"
                  [previews]="previews()"
                  [fileNames]="fileNames()"
                  [labels]="currentLabels"
                  [gap]="gapSize()"
                  (fileSelected)="onFileForSlot($event.index, $event.file)"
                />
              </div>
              <span class="text-2xs text-text-muted"
                >{{ fmt }} {{ fmt === '4:3' ? 'landscape' : 'portrait' }}</span
              >
            </div>
          }
        </div>

        <!-- Results -->
        @if (results().length > 0) {
          <div class="pt-4 border-t border-border">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold">Results</h3>
              <button
                (click)="downloadBundle()"
                class="px-4 py-2 text-sm rounded-lg bg-bg-secondary border border-border text-text-secondary hover:bg-hover active:bg-active active:text-bg-primary transition-colors"
              >
                Download Bundle (ZIP)
              </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              @for (r of results(); track r.format) {
                <div
                  class="bg-bg-secondary rounded-lg overflow-hidden border border-border"
                >
                  <a
                    [href]="r.canvasUrl"
                    target="_blank"
                    class="h-64 flex items-center justify-center bg-bg-canvas"
                  >
                    <img
                      [src]="r.canvasUrl"
                      class="max-w-full max-h-full object-contain"
                    />
                  </a>
                  <div
                    class="p-3 flex items-center justify-between border-t border-border"
                  >
                    <span class="text-sm text-text-secondary">{{
                      r.format
                    }}</span>
                    <button
                      (click)="downloadResult(r)"
                      class="text-xs px-3 py-1 rounded bg-bg-secondary border border-border text-text-secondary hover:bg-hover active:bg-active active:text-bg-primary transition-colors"
                    >
                      Download
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </tool-shell>
  `,
})
export class LayoutGeneratorComponent {
  patternOptions = PATTERN_OPTIONS;
  patternThumbs = PATTERN_THUMBS;
  gapOptions = GAP_OPTIONS;
  formats: LayoutFormat[] = ['4:3', '3:4'];

  selectedPattern = signal<LayoutPattern>(PATTERN_OPTIONS[0].value);
  maxQuality = signal(false);
  gapSize = signal<number>(DEFAULT_GAP);
  isGenerating = signal(false);

  files = signal<(File | null)[]>(Array(PATTERN_OPTIONS[0].slots).fill(null));
  previews = signal<(string | null)[]>(
    Array(PATTERN_OPTIONS[0].slots).fill(null),
  );
  fileNames = signal<string[]>(Array(PATTERN_OPTIONS[0].slots).fill(''));
  results = signal<LayoutResult[]>([]);

  constructor(private layoutsService: LayoutsService) {
    // An object URL is owned by the browser's blob store, not by JavaScript,
    // so dropping every reference to it frees nothing: garbage collection
    // cannot reach it. Without this the previews and every generated layout
    // stayed resident for the life of the tab, and another copy piled up each
    // time the page was visited again.
    inject(DestroyRef).onDestroy(() => {
      this.revokePreviews();
      this.revokeResults();
    });
  }

  /** Releases the slot previews. Safe to call when slots are already empty. */
  private revokePreviews(): void {
    this.previews().forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
  }

  /** Releases the generated layouts, each of which owns a canvas and crops. */
  private revokeResults(): void {
    this.results().forEach((result) => {
      URL.revokeObjectURL(result.canvasUrl);
      result.crops.forEach((crop) => URL.revokeObjectURL(crop.url));
    });
  }

  get currentOption(): PatternOption {
    return PATTERN_OPTIONS.find((p) => p.value === this.selectedPattern())!;
  }

  get currentSlots() {
    return LAYOUT_PATTERNS[this.selectedPattern()]['4:3'].slots;
  }

  get currentLabels(): string[] {
    return this.currentOption.labels;
  }

  get canGenerate(): boolean {
    const files = this.files();
    return files.length > 0 && files.every((f) => f != null);
  }

  onPatternChange(pattern: LayoutPattern): void {
    if (pattern === this.selectedPattern()) return;
    const opt = PATTERN_OPTIONS.find((p) => p.value === pattern)!;
    // Switching patterns discards the current work, so both sets go with it.
    this.revokePreviews();
    this.revokeResults();
    this.selectedPattern.set(pattern);
    this.files.set(Array(opt.slots).fill(null));
    this.previews.set(Array(opt.slots).fill(null));
    this.fileNames.set(Array(opt.slots).fill(''));
    this.results.set([]);
  }

  onFileForSlot(index: number, file: File): void {
    const url = URL.createObjectURL(file);
    const prevUrl = this.previews()[index];
    if (prevUrl) URL.revokeObjectURL(prevUrl);

    this.files.update((f) => {
      const next = [...f];
      next[index] = file;
      return next;
    });
    this.previews.update((p) => {
      const next = [...p];
      next[index] = url;
      return next;
    });
    this.fileNames.update((n) => {
      const next = [...n];
      next[index] = file.name;
      return next;
    });
  }

  async generate(): Promise<void> {
    const pattern = this.selectedPattern();
    const slots = this.currentSlots;
    const files = this.files();

    const images: SlotImage[] = slots.map((s, i) => ({
      name: s.name,
      file: files[i]!,
      url: this.previews()[i]!,
    }));

    this.isGenerating.set(true);
    try {
      this.revokeResults();
      const results = await this.layoutsService.generateAllLayouts(
        images,
        pattern,
        this.maxQuality(),
        this.gapSize(),
      );
      this.results.set(results);
    } finally {
      this.isGenerating.set(false);
    }
  }

  downloadResult(result: LayoutResult): void {
    this.layoutsService.downloadBlob(
      result.canvasBlob,
      `layout_${result.format}.jpg`,
    );
  }

  async downloadBundle(): Promise<void> {
    await this.layoutsService.downloadBundle(
      this.results(),
      this.selectedPattern(),
    );
  }
}
