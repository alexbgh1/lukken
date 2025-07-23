import { TestBed } from '@angular/core/testing';

import { FiltersDataService } from './filters-data.service';

describe('FiltersDataService', () => {
  let service: FiltersDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FiltersDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
