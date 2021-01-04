import { TestBed } from '@angular/core/testing';

import { CapitalizationService } from './capitalization.service';

describe('CapitalizationService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: CapitalizationService = TestBed.get(CapitalizationService);
    expect(service).toBeTruthy();
  });
});
