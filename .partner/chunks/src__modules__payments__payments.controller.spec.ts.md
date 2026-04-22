# FILE: src/modules/payments/payments.controller.spec.ts

path: src/modules/payments/payments.controller.spec.ts
module: payments
kind: spec
language: ts
line_count: 19
size_bytes: 524
sha256: cc9ec69963d7010b2917280132048951f486b3ce352398393c410a3e6f876b0e
updated_at: 2026-03-22T08:37:56.763Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';

describe('PaymentsController', () => {
  let controller: PaymentsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
    }).compile();

    controller = module.get<PaymentsController>(PaymentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});

````
