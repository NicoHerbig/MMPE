import { TestBed } from '@angular/core/testing';

import { TouchService } from './touch.service';

describe('DragAndDropService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: TouchService = TestBed.get(TouchService);
    expect(service).toBeTruthy();
  });
});
