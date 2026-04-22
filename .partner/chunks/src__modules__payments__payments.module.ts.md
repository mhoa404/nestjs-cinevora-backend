# FILE: src/modules/payments/payments.module.ts

path: src/modules/payments/payments.module.ts
module: payments
kind: module
language: ts
line_count: 12
size_bytes: 311
sha256: c5c5086e7f20fe9518cb959060fe324d7df8f321515522d152f77d30d4efe64d
updated_at: 2026-04-02T08:59:54.811Z

## SYMBOLS
- PaymentsModule

## CODE

````ts
import { Module } from '@nestjs/common';

import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}

````
