import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Booking } from '../../bookings/entities/booking.entity';

export enum PaymentMethod {
  MOMO = 'momo',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  AUTHORIZED = 'authorized',
}

export interface PaymentGatewayMetadata {
  [key: string]: unknown;
}

@Entity('payments')
@Index('IDX_payments_booking_id', ['bookingId'])
@Index('IDX_payments_gateway_order_id', ['gatewayOrderId'], { unique: true })
@Index('IDX_payments_gateway_trans_id', ['gatewayTransId'])
@Index('IDX_payments_status', ['status'])
export class Payment {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'booking_id', type: 'int' })
  bookingId!: number;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 0 })
  amount!: number;

  @Column({
    name: 'method',
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.MOMO,
  })
  method!: PaymentMethod;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status!: PaymentStatus;

  @Column({
    name: 'gateway_order_id',
    type: 'varchar',
    length: 100,
  })
  gatewayOrderId!: string;

  @Column({
    name: 'gateway_trans_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  gatewayTransId!: string | null;

  @Column({
    name: 'gateway_metadata',
    type: 'json',
    nullable: true,
  })
  gatewayMetadata!: PaymentGatewayMetadata | null;

  @Column({
    name: 'paid_at',
    type: 'datetime',
    precision: 3,
    nullable: true,
  })
  paidAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
    onUpdate: 'CURRENT_TIMESTAMP(3)',
  })
  updatedAt!: Date;

  @ManyToOne(() => Booking, (booking) => booking.payments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;
}
