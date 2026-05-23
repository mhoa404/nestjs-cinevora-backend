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

@Entity('payments')
@Index('IDX_payments_booking_id', ['bookingId'])
@Index('IDX_payments_momo_order_id', ['momoOrderId'], { unique: true })
@Index('IDX_payments_momo_request_id', ['momoRequestId'], { unique: true })
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
    name: 'momo_order_id',
    type: 'varchar',
    length: 100,
  })
  momoOrderId!: string;

  @Column({
    name: 'momo_request_id',
    type: 'varchar',
    length: 100,
  })
  momoRequestId!: string;

  @Column({
    name: 'momo_trans_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  momoTransId!: string | null;

  @Column({
    name: 'pay_url',
    type: 'text',
    nullable: true,
  })
  payUrl!: string | null;

  @Column({
    name: 'short_link',
    type: 'text',
    nullable: true,
  })
  shortLink!: string | null;

  @Column({
    name: 'result_code',
    type: 'int',
    nullable: true,
  })
  resultCode!: number | null;

  @Column({
    name: 'message',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  message!: string | null;

  @Column({
    name: 'response_time',
    type: 'bigint',
    nullable: true,
  })
  responseTime!: string | null;

  @Column({
    name: 'raw_response',
    type: 'json',
    nullable: true,
  })
  rawResponse!: Record<string, unknown> | null;

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
