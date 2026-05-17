// src/modules/bookings/entities/booking-seat.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { SeatType } from '../../../common/constants/seat-type.constant';
import { Seat } from '../../seats/entities/seat.entity';
import { Booking } from './booking.entity';

@Entity('booking_seats')
export class BookingSeat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'booking_id', type: 'int' })
  bookingId!: number;

  @Column({ name: 'seat_id', type: 'int' })
  seatId!: number;

  @Column({ name: 'seat_key', type: 'varchar', length: 10 })
  seatKey!: string;

  @Column({ name: 'price', type: 'decimal', precision: 10, scale: 0 })
  price!: number;

  @Column({
    name: 'snapshot_seat_type',
    type: 'enum',
    enum: SeatType,
    default: SeatType.STANDARD,
  })
  snapshotSeatType!: SeatType;

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

  @ManyToOne(() => Booking, (booking) => booking.bookingSeats, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @ManyToOne(() => Seat, (seat) => seat.bookingSeats, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'seat_id' })
  seat!: Seat;
}
