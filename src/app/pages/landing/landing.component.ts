import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowUpRightIconComponent } from '@shared/icons/arrow-up-right.component';

type SampleKey =
  | 'source'
  | 'halftone'
  | 'glass'
  | 'pixelSort'
  | 'nodes'
  | 'layouts';

interface BentoCard {
  name: string;
  href: string;
  line: string;
  key: SampleKey;
  /** Tailwind span classes for this card's bento cell. */
  span: string;
}

/**
 * Real output from the tools, served straight out of `public/`.
 *
 * `source` is deliberately absent: no untouched photograph has been supplied
 * yet, so the figure that would show it stays hidden. Adding one here is all
 * it takes to bring that figure back.
 */
const SAMPLE_ASSETS: Partial<Record<SampleKey, string>> = {
  halftone: 'samples/halftone.jpg',
  glass: 'samples/glass.jpg',
  pixelSort: 'samples/pixel-sort.jpg',
  nodes: 'samples/3d-nodes.jpg',
  layouts: 'samples/layouts.jpg',
};

@Component({
  imports: [RouterLink, ArrowUpRightIconComponent],
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit {
  isVisible = signal(false);

  /**
   * The bento. Halftone leads at double width because its output is the least
   * guessable from its name, Fractal Glass runs tall because refraction reads
   * better down a vertical frame, and the three below carry equal weight.
   */
  readonly cards: BentoCard[] = [
    {
      name: 'Halftone',
      href: '/halftone',
      line: "Breaks the frame into a printer's screen of dots.",
      key: 'halftone',
      span: 'md:col-span-2 md:row-span-2',
    },
    {
      name: 'Fractal Glass',
      href: '/glass',
      line: 'Refracts it through a procedural height map.',
      key: 'glass',
      span: 'md:row-span-2',
    },
    {
      name: 'Pixel Sort',
      href: '/pixel-sort',
      line: 'Shifts pixels in different patterns.',
      key: 'pixelSort',
      span: '',
    },
    {
      name: '3D Nodes',
      href: '/3d-nodes',
      line: 'Take a look at the 3D nodes and color visualization.',
      key: 'nodes',
      span: '',
    },
    {
      name: 'Layouts',
      href: '/layouts',
      line: 'Create a layout for your images.',
      key: 'layouts',
      span: '',
    },
  ];

  ngOnInit(): void {
    setTimeout(() => this.isVisible.set(true), 100);
  }

  imageFor(key: SampleKey): string | null {
    return SAMPLE_ASSETS[key] ?? null;
  }

  /** The untouched photograph, if one has been supplied. */
  sourceImage(): string | null {
    return this.imageFor('source');
  }
}
