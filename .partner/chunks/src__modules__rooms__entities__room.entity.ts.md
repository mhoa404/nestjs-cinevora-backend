# FILE: src/modules/rooms/entities/room.entity.ts

path: src/modules/rooms/entities/room.entity.ts
module: rooms
kind: entity
language: ts
line_count: 42
size_bytes: 914
sha256: bea7240c16f5a1edba8eda97920a78caf100b8306e154ae707f870075ed322d5
updated_at: 2026-04-21T14:16:18.363Z

## SYMBOLS
- Room

## CODE

````ts
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Showtime } from '../../showtimes/entities/showtime.entity';
import { Seat } from '../../seats/entities/seat.entity';
import { UpdateDateColumn } from 'typeorm';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 20, unique: true })
  name!: string;

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

  @OneToMany(() => Showtime, (showtime) => showtime.room)
  showtimes!: Showtime[];

  @OneToMany(() => Seat, (seat) => seat.room)
  seats!: Seat[];
}

````
