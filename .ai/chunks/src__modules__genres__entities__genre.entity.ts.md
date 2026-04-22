# FILE: src/modules/genres/entities/genre.entity.ts

path: src/modules/genres/entities/genre.entity.ts
module: genres
kind: entity
language: ts
line_count: 41
size_bytes: 807
sha256: 8423cb0f8eacee6a4529791ac20e589a2ff187f9ff3fbe5ff3d9d45c9a3691df
updated_at: 2026-04-22T03:38:04.076Z

## SYMBOLS
- Genre

## CODE

````ts
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Movie } from '../../movies/entities/movie.entity';

@Entity('genres')
export class Genre {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 100, unique: true })
  name!: string;

  @Column({ length: 100, unique: true })
  slug!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @ManyToMany(() => Movie, (movie) => movie.genres)
  movies!: Movie[];
}

````
