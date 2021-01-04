/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { ReorderService } from './reorder.service';

describe('Service: Reorder', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ReorderService]
    });
  });

  it('should ...', inject([ReorderService], (service: ReorderService) => {
    expect(service).toBeTruthy();
  }));
});
