import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { Showtime } from '../../showtimes/entities/showtime.entity';

export enum AgeRating {
  P = 'P',
  C13 = 'C13',
  C16 = 'C16',
  C18 = 'C18',
}

@Entity('movies')
export class Movie {
  @PrimaryColumn({ length: 100 })
  id!: string;

  @Column({ length: 255 })
  title!: string;

  @Column({ name: 'poster_url', type: 'text' })
  posterUrl!: string;

  @Column({ name: 'trailer_url', type: 'text', nullable: true })
  trailerUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int' })
  duration!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  genre!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  director!: string | null;

  @Column({ type: 'text', nullable: true })
  actor!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language!: string | null;

  @Column({ type: 'enum', enum: AgeRating })
  ageRating!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  rated!: string | null;

  @Column({ name: 'is_upcoming', type: 'boolean', default: false })
  isUpcoming!: boolean;

  @Column({ name: 'release_date', type: 'date' })
  releaseDate!: Date;

  @Column({
    name: 'avg_rating',
    type: 'decimal',
    precision: 3,
    scale: 1,
    nullable: true,
  })
  avgRating!: number | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @OneToMany(() => Showtime, (showtime) => showtime.movie)
  showtimes!: Showtime[];
}
