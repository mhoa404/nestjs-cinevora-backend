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

  @Column({ name: 'start_time', type: 'timestamp' })
  startTime!: Date;

  @Column({ name: 'end_time', type: 'timestamp' })
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

  @ManyToOne(() => Movie, (movie) => movie.showtimes)
  @JoinColumn({ name: 'movie_id' })
  movie!: Movie;

  @ManyToOne(() => Room, (room) => room.showtimes)
  @JoinColumn({ name: 'room_id' })
  room!: Room;

  @OneToMany(() => Booking, (booking) => booking.showtime)
  bookings!: Booking[];
}
