# FILE: src/modules/seats/entities/seat.entity.ts

path: src/modules/seats/entities/seat.entity.ts
module: seats
kind: entity
language: ts
line_count: 66
size_bytes: 1500
sha256: b265512a6d6b297ac378c73692d083e445496d6cd5bc349f13432d81ca3eaa98
updated_at: 2026-04-22T03:38:06.276Z

## SYMBOLS
- Seat

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
import { BookingSeat } from '../../bookings/entities/booking-seat.entity';
import { SeatType } from '../../../common/constants/seat-type.constant';
import { Room } from '../../rooms/entities/room.entity';

@Entity('seats')
export class Seat {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'room_id' })
  roomId!: number;

  @Column({ name: 'seat_key', length: 10 })
  seatKey!: string;

  @Column({ name: 'row_label', length: 10 })
  rowLabel!: string;

  @Column({ name: 'seat_number', type: 'int' })
  seatNumber!: number;

  @Column({
    name: 'seat_type',
    type: 'enum',
    enum: SeatType,
    default: SeatType.STANDARD,
  })
  seatType!: SeatType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

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

  //Realation
  @ManyToOne(() => Room, (room) => room.seats)
  @JoinColumn({ name: 'room_id' })
  room!: Room;

  @OneToMany(() => BookingSeat, (bookingSeat) => bookingSeat.seat)
  bookingSeats!: BookingSeat[];
}

````
