# FILE: src/modules/seats/seats.service.spec.ts

path: src/modules/seats/seats.service.spec.ts
module: seats
kind: spec
language: ts
line_count: 19
size_bytes: 471
sha256: 4ff52957cd91cd3fe825e2ed5e2ca5cb3c101ba022d4be49ce001caa6c7a702a
updated_at: 2026-03-22T08:37:56.819Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { SeatsService } from './seats.service';

describe('SeatsService', () => {
  let service: SeatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeatsService],
    }).compile();

    service = module.get<SeatsService>(SeatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

````
