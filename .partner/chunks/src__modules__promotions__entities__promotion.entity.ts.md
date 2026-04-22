# FILE: src/modules/promotions/entities/promotion.entity.ts

path: src/modules/promotions/entities/promotion.entity.ts
module: promotions
kind: entity
language: ts
line_count: 68
size_bytes: 1280
sha256: 1f34d0e3cb891eacf16a9af050e3bc9e8460dc33186a8947cc7909fa79b3d459
updated_at: 2026-04-02T08:59:54.811Z

## SYMBOLS
- Promotion

## CODE

````ts
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum PromotionType {
  HIGHTLIGHT = 'highlight',
  GRID = 'grid',
  TOP = 'top',
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl!: string | null;

  @Column({
    name: 'discount_percent',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  discountPercent!: number | null;

  @Column({
    name: 'promotion_type',
    type: 'enum',
    enum: PromotionType,
    default: PromotionType.GRID,
  })
  promotionType!: PromotionType;

  @Column({
    name: 'start_date',
    type: 'date',
    nullable: true,
  })
  startDate!: Date | null;

  @Column({
    name: 'end_date',
    type: 'date',
    nullable: true,
  })
  endDate!: Date | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive!: boolean;

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;
}

````
