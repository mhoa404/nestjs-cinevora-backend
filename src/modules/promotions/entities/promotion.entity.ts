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
