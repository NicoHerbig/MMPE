import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SegmentsComponent } from './segments.component';

describe('SegmentsComponent', () => {
  let component: SegmentsComponent;
  let fixture: ComponentFixture<SegmentsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SegmentsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SegmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
