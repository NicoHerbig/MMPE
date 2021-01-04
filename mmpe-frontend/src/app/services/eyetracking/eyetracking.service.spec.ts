import { TestBed } from '@angular/core/testing';

import { EyetrackingService } from './eyetracking.service';

describe('EyetrackingService', () => {
  let service: EyetrackingService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EyetrackingService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
