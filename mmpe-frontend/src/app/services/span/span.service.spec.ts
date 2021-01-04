import { TestBed } from '@angular/core/testing';

import { SpanService } from './span.service';

describe('SpanService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: SpanService = TestBed.get(SpanService);
    expect(service).toBeTruthy();
  });
});
