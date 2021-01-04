import { TestBed } from '@angular/core/testing';

import { MidairGesturesService } from './midair-gestures.service';

describe('MidairGesturesService', () => {
  let service: MidairGesturesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MidairGesturesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
