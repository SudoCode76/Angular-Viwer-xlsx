import { TestBed } from '@angular/core/testing';

import { XlsxDataService } from './xlsx-data-service';

describe('XlsxDataService', () => {
  let service: XlsxDataService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(XlsxDataService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
