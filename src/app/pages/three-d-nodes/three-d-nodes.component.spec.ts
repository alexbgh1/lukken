import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreeDNodesComponent } from './three-d-nodes.component';

describe('ThreeDNodesComponent', () => {
  let component: ThreeDNodesComponent;
  let fixture: ComponentFixture<ThreeDNodesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreeDNodesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThreeDNodesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
