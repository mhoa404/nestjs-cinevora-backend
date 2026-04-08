import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Showtime } from '../../showtimes/entities/showtime.entity';
import { Genre } from '../../genres/entities/genre.entity';

export enum AgeRating {
  P = 'P',
  C13 = 'C13',
  C16 = 'C16',
  C18 = 'C18',
}

export enum MovieStatus {
  SHOWING = 'now_showing',
<<<<<<< HEAD
  COMING = 'upcoming',
=======
  COMMING = 'upcoming',
>>>>>>> origin/main
  ENDED = 'ended',
}

@Entity('movies')
export class Movie {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  title!: string;

<<<<<<< HEAD
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  slug!: string | null;
=======
  @Column({ length: 255, unique: true, nullable: true })
  slug!: string;
>>>>>>> origin/main

  @Column({ name: 'poster_url', type: 'text' })
  posterUrl!: string;

  @Column({ name: 'trailer_url', type: 'text', nullable: true })
  trailerUrl!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'int' })
  duration!: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  director!: string | null;

  @Column({ type: 'text', nullable: true })
  actor!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  language!: string | null;

  @Column({ name: 'age_rating', type: 'enum', enum: AgeRating })
<<<<<<< HEAD
  ageRating!: AgeRating;
=======
  ageRating!: string | null;
>>>>>>> origin/main

  @Column({ type: 'varchar', length: 100, nullable: true })
  rated!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: MovieStatus,
<<<<<<< HEAD
    default: MovieStatus.COMING,
=======
    default: MovieStatus.COMMING,
>>>>>>> origin/main
  })
  status!: MovieStatus;

  @Column({ name: 'release_date', type: 'date' })
  releaseDate!: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: Date | null;

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
<<<<<<< HEAD

=======
>>>>>>> origin/main
  @ManyToMany(() => Genre, (genre) => genre.movies)
  @JoinTable({
    name: 'movie_genres',
    joinColumn: { name: 'movie_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genre_id', referencedColumnName: 'id' },
  })
  genres!: Genre[];
}
