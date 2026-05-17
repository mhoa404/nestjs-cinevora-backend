import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Seat } from '../../seats/entities/seat.entity';
import { Showtime } from '../../showtimes/entities/showtime.entity';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 20, unique: true })
  name!: string;

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
  @OneToMany(() => Showtime, (showtime) => showtime.room)
  showtimes!: Showtime[];

  @OneToMany(() => Seat, (seat) => seat.room)
  seats!: Seat[];
}
