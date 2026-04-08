import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
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

  //Realation
  @ManyToOne(() => Room, (room) => room.seats)
  @JoinColumn({ name: 'room_id' })
  room!: Room;

  @OneToMany(() => BookingSeat, (bookingSeat) => bookingSeat.seat)
  bookingSeats!: BookingSeat[];
}
