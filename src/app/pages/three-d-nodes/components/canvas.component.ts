import { Component } from '@angular/core';
import { FiltersDataService } from '../services/filters-data.service';

@Component({
  imports: [],
  selector: 'three-d-nodes-canvas',
  templateUrl: './canvas.component.html',
})
export class CanvasComponent {
  constructor(private filterDataService: FiltersDataService) {
    console.log(
      'CanvasComponent: Initialized with FiltersDataService',
      this.filterDataService.currentFilters()
    );
  }
}
