# FILE: src/modules/showtimes/entities/showtime.entity.ts

path: src/modules/showtimes/entities/showtime.entity.ts
module: showtimes
kind: entity
language: ts
line_count: 84
size_bytes: 1875
sha256: 6c17a7eab9b62f7a73bee62fafd35102cc798808e1f17b838b0d5cb74f8a24d5
updated_at: 2026-04-22T13:29:40.198Z

## SYMBOLS
- Showtime

## CODE

````ts
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Booking } from '../../bookings/entities/booking.entity';
import { Movie } from '../../movies/entities/movie.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('showtimes')
export class Showtime {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'movie_id' })
  movieId!: number;

  @Column({ name: 'room_id' })
  roomId!: number;

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamp' })
  endTime!: Date;

  @Column({ name: 'price_standard', type: 'decimal', precision: 10, scale: 0 })
  priceStandard!: number;

  @Column({ name: 'price_vip', type: 'decimal', precision: 10, scale: 0 })
  priceVip!: number;

  @Column({
    name: 'price_premium',
    type: 'decimal',
    precision: 10,
    scale: 0,
    nullable: true,
  })
  pricePremium!: number | null;

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
  @ManyToOne(() => Movie, (movie) => movie.showtimes)
  @JoinColumn({ name: 'movie_id' })
  movie!: Movie;

  @ManyToOne(() => Room, (room) => room.showtimes)
  @JoinColumn({ name: 'room_id' })
  room!: Room;

  @OneToMany(() => Booking, (booking) => booking.showtime)
  bookings!: Booking[];
}

````
