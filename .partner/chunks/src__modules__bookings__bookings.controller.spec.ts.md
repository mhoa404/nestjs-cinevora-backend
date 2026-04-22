# FILE: src/modules/bookings/bookings.controller.spec.ts

path: src/modules/bookings/bookings.controller.spec.ts
module: bookings
kind: spec
language: ts
line_count: 19
size_bytes: 524
sha256: 216c0525a9c592a86dd33713c00264219aac17ccab7fdddb06091b6bac7c708c
updated_at: 2026-03-22T08:37:56.722Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { BookingsController } from './bookings.controller';

describe('BookingsController', () => {
  let controller: BookingsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BookingsController],
    }).compile();

    controller = module.get<BookingsController>(BookingsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

````
