# FILE: src/modules/payments/payments.service.spec.ts

path: src/modules/payments/payments.service.spec.ts
module: payments
kind: spec
language: ts
line_count: 19
size_bytes: 492
sha256: 2cc61b338f508c3b2e375b95405cf34f7f1bb8cbe8d1ae383b69dcf26887ad3e
updated_at: 2026-03-22T08:37:56.767Z

## SYMBOLS
- (none detected)

## CODE

````ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaymentsService],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

````
