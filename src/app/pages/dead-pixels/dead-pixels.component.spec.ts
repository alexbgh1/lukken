import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeadPixelsComponent } from './dead-pixels.component';

describe('DeadPixelsComponent', () => {
  let component: DeadPixelsComponent;
  let fixture: ComponentFixture<DeadPixelsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeadPixelsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeadPixelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
