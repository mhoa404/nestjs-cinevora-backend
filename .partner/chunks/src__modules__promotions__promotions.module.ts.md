# FILE: src/modules/promotions/promotions.module.ts

path: src/modules/promotions/promotions.module.ts
module: promotions
kind: module
language: ts
line_count: 15
size_bytes: 503
sha256: 13199586635a3aa7a302a43352f011a01dbba6da149f86174a75341faf66bb00
updated_at: 2026-04-02T08:59:54.811Z

## SYMBOLS
- PromotionsModule

## CODE

````ts
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { Promotion } from './entities/promotion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Promotion])],
  providers: [PromotionsService],
  controllers: [PromotionsController],
  exports: [TypeOrmModule, PromotionsService],
})
export class PromotionsModule {}

````
