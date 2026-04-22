# FILE: src/modules/bookings/bookings.service.spec.ts

path: src/modules/bookings/bookings.service.spec.ts
module: bookings
kind: spec
language: ts
line_count: 19
size_bytes: 492
sha256: cb6ff962c74ad69bb486985ad53b2095f5500f1a222f6037dd02426832fce684
updated_at: 2026-03-22T08:37:56.724Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  let service: BookingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BookingsService],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

````
