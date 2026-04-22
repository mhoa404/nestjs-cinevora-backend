# FILE: src/modules/promotions/promotions.controller.spec.ts

path: src/modules/promotions/promotions.controller.spec.ts
module: promotions
kind: spec
language: ts
line_count: 19
size_bytes: 538
sha256: b6291b8d565e4fe37871fe41f6381c66456b9e59e2d92dd54efa1ebfde5f549b
updated_at: 2026-03-22T08:37:56.772Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsController } from './promotions.controller';

describe('PromotionsController', () => {
  let controller: PromotionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotionsController],
    }).compile();

    controller = module.get<PromotionsController>(PromotionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

````
