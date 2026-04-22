# FILE: src/modules/bookings/entities/booking.entity.ts

path: src/modules/bookings/entities/booking.entity.ts
module: bookings
kind: entity
language: ts
line_count: 99
size_bytes: 2349
sha256: 3865f218e18a166959d334effcb27b585e19890382bae1017d05fd61e8586e99
updated_at: 2026-04-22T03:38:28.271Z

## SYMBOLS
- Booking

## CODE

````ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Showtime } from '../../showtimes/entities/showtime.entity';
import { User } from '../../users/entities/user.entity';
import { BookingSeat } from './booking-seat.entity';

export enum BookingStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  USED = 'used',
}

export enum PaymentMethod {
  CASH = 'cash',
  MOMO = 'momo',
  ZALOPAY = 'zalopay',
  CREDIT_CARD = 'credit_card',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'showtime_id' })
  showtimeId!: number;

  @Column({ name: 'ticket_count', type: 'int' })
  ticketCount!: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 0 })
  totalPrice!: number;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod!: PaymentMethod;

  @Column({ name: 'booked_at', type: 'timestamp' })
  bookedAt!: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  @Column({ name: 'snapshot_movie_title', length: 255 })
  snapshotMovieTitle!: string;

  @Column({ name: 'snapshot_cinema_name', length: 100 })
  snapshotCinemaName!: string;

  @Column({ name: 'snapshot_room_name', length: 20 })
  snapshotRoomName!: string;

  @Column({ name: 'snapshot_showtime_start', type: 'timestamp' })
  snapshotShowtimeStart!: Date;

  @Column({
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
  @ManyToOne(() => User, (user) => user.bookings)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Showtime, (showtime) => showtime.bookings)
  @JoinColumn({ name: 'showtime_id' })
  showtime!: Showtime;

  @OneToMany(() => BookingSeat, (bookingSeat) => bookingSeat.booking)
  bookingSeats!: BookingSeat[];
}

````
