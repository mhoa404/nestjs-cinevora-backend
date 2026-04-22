# FILE: src/modules/seats/seats.controller.spec.ts

path: src/modules/seats/seats.controller.spec.ts
module: seats
kind: spec
language: ts
line_count: 19
size_bytes: 503
sha256: 96d6dd2927be722edf9e83f4ddcef11df57414b38b4668832708ea231973ffbf
updated_at: 2026-03-22T08:37:56.807Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { SeatsController } from './seats.controller';

describe('SeatsController', () => {
  let controller: SeatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SeatsController],
    }).compile();

    controller = module.get<SeatsController>(SeatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

````
