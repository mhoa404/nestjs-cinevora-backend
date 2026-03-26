import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Booking } from '../../bookings/entities/booking.entity';
import { Movie } from '../../movies/entities/movie.entity';
import { Room } from '../../rooms/entities/room.entity';

@Entity('showtimes')
export class Showtime {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'movie_id' })
  movieId!: string;

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

  @Column({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

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
