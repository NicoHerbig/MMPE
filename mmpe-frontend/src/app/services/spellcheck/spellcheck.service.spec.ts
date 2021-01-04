import { TestBed } from '@angular/core/testing';

import { SpellcheckService } from './spellcheck.service';

describe('SpellcheckService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: SpellcheckService = TestBed.get(SpellcheckService);
    expect(service).toBeTruthy();
  });
});
