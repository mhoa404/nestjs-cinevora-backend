# FILE: src/modules/promotions/promotions.service.spec.ts

path: src/modules/promotions/promotions.service.spec.ts
module: promotions
kind: spec
language: ts
line_count: 19
size_bytes: 506
sha256: f7348951b885cc15660c900da3fcc65be1b96641b3f2cf187277c802f889fb25
updated_at: 2026-03-22T08:37:56.774Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsService } from './promotions.service';

describe('PromotionsService', () => {
  let service: PromotionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromotionsService],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

````
