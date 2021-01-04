import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { EditingPageComponent } from './editing-page.component';

describe('EditingPageComponent', () => {
  let component: EditingPageComponent;
  let fixture: ComponentFixture<EditingPageComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ EditingPageComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(EditingPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
