import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SupportToolsComponent } from './support-tools.component';

describe('SupportToolsComponent', () => {
  let component: SupportToolsComponent;
  let fixture: ComponentFixture<SupportToolsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SupportToolsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SupportToolsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
