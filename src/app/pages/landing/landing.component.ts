import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

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
  selector: 'app-landing',
  imports: [
    CommonModule,
    // CameraIconComponent,
    // EyeIconComponent,
    // ShuffleIconComponent,
    // Layers3IconComponent,
    // ArrowRightIconComponent,
    // ChevronDownIconComponent,
    // GithubIconComponent,
    // TwitterIconComponent,
    // MailIconComponent,
  ],
  templateUrl: './landing.component.html',
})
export class LandingComponent implements OnInit {
  activeSection = 0;
  isVisible = false;

  ngOnInit(): void {
    setTimeout(() => {
      this.isVisible = true;
    }, 100);
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  setActiveSection(index: number): void {
    this.activeSection = index;
  }

  trackByTool(index: number, tool: Tool): string {
    return tool.id;
  }

  trackByFeature(index: number, feature: string): string {
    return feature;
  }
}
