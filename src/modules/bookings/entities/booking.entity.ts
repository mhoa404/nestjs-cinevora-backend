import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Payment } from '../../payments/entities/payment.entity';
import { Showtime } from '../../showtimes/entities/showtime.entity';
import { User } from '../../users/entities/user.entity';
import { BookingSeat } from './booking-seat.entity';

export enum BookingStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'showtime_id', type: 'int' })
  showtimeId!: number;

  @Column({ name: 'ticket_count', type: 'int' })
  ticketCount!: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 0 })
  totalPrice!: number;

  @Column({
    name: 'booked_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  bookedAt!: Date;

  @Column({
    name: 'expires_at',
    type: 'datetime',
    precision: 3,
  })
  expiresAt!: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: BookingStatus,
    default: BookingStatus.PENDING,
  })
  status!: BookingStatus;

  @Column({ name: 'snapshot_movie_title', type: 'varchar', length: 255 })
  snapshotMovieTitle!: string;

  @Column({ name: 'snapshot_room_name', type: 'varchar', length: 20 })
  snapshotRoomName!: string;

  @Column({ name: 'snapshot_showtime_start', type: 'datetime', precision: 3 })
  snapshotShowtimeStart!: Date;

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

  @ManyToOne(() => User, (user) => user.bookings, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Showtime, (showtime) => showtime.bookings, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'showtime_id' })
  showtime!: Showtime;

  @OneToMany(() => BookingSeat, (bookingSeat) => bookingSeat.booking)
  bookingSeats!: BookingSeat[];

  @OneToMany(() => Payment, (payment) => payment.booking)
  payments!: Payment[];
}
