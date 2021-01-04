import { TestBed } from '@angular/core/testing';

import { UndoRedoService } from './undo-redo.service';

describe('UndoRedoService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: UndoRedoService = TestBed.get(UndoRedoService);
    expect(service).toBeTruthy();
  });
});
