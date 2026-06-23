import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { ArrowUpRightIconComponent } from '@shared/icons/arrow-up-right.component';
import { NAV_LINKS_OBJECTS } from '@shared/constants/nav-links.constants';

interface Tool {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  borderColor: string;
  features: string[];
}

@Component({
  imports: [RouterLink, ArrowUpRightIconComponent],
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit {
  activeSection = 0;
  isVisible = signal(false);

  NAV_LINKS_OBJECTS = NAV_LINKS_OBJECTS;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    setTimeout(() => {
      this.isVisible.set(true);
    }, 100);
  }
}
