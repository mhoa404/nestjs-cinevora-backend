# FILE: src/modules/bookings/entities/booking-seat.entity.ts

path: src/modules/bookings/entities/booking-seat.entity.ts
module: bookings
kind: entity
language: ts
line_count: 64
size_bytes: 1436
sha256: f72173d0ae55263c9cf7eb65e0d2ad7234ee64a44b9ed64ba9f12c80ceb99ca5
updated_at: 2026-04-22T03:38:30.482Z

## SYMBOLS
- BookingSeat

## CODE

````ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Seat } from '../../seats/entities/seat.entity';
import { Booking } from './booking.entity';
import { SeatType } from '../../../common/constants/seat-type.constant';

@Entity('booking_seats')
export class BookingSeat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'booking_id' })
  bookingId!: number;

  @Column({ name: 'seat_id' })
  seatId!: number;

  @Column({ name: 'seat_key', length: 10 })
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
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  //Relation
  @ManyToOne(() => Booking, (booking) => booking.bookingSeats)
  @JoinColumn({ name: 'booking_id' })
  booking!: Booking;

  @ManyToOne(() => Seat, (seat) => seat.bookingSeats)
  @JoinColumn({ name: 'seat_id' })
  seat!: Seat;
}

````
