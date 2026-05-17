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

import { Booking } from '../../bookings/entities/booking.entity';
import { Movie } from '../../movies/entities/movie.entity';
import { Room } from '../../rooms/entities/room.entity';

export enum ShowtimeStatus {
  OPEN = 'open',
  SOLD_OUT = 'sold_out',
}

@Entity('showtimes')
export class Showtime {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'movie_id' })
  movieId!: number;

  @Column({ name: 'room_id' })
  roomId!: number;

  @Column({ name: 'start_time', type: 'datetime', precision: 3 })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'datetime', precision: 3 })
  endTime!: Date;

  @Column({
    type: 'enum',
    enum: ShowtimeStatus,
    default: ShowtimeStatus.OPEN,
  })
  status!: ShowtimeStatus;

  @Column({ name: 'price_standard', type: 'decimal', precision: 10, scale: 0 })
  priceStandard!: number;

  @Column({ name: 'price_vip', type: 'decimal', precision: 10, scale: 0 })
  priceVip!: number;

  @Column({
    name: 'price_couple',
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
  })
  priceCouple!: number | null;

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

  // Relations
  @ManyToOne(() => Movie, (movie) => movie.showtimes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'movie_id' })
  movie!: Movie;

  @ManyToOne(() => Room, (room) => room.showtimes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room!: Room;

  @OneToMany(() => Booking, (booking) => booking.showtime)
  bookings!: Booking[];
}
