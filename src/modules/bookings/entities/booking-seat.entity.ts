import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Booking } from "./booking.entity";
import { Seat } from "../../seats/entities/seat.entity";

@Entity('booking_seats')
export class BookingSeat {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'booking_id' })
    bookingId!: number;

    @Column({ name: 'seat_id' })
    seatId!: number;

    @Column({ name: 'seat_key', length: 10 })
    seatKey!: string;

    @Column({ name: 'price', type: 'decimal', precision: 10, scale: 0 })
    price!: number;

    //Relation
    @ManyToOne(() => Booking, (booking) => booking.bookingSeats)
    @JoinColumn({ name: 'booking_id' })
    booking!: Booking;

    @ManyToOne(() => Seat, (seat) => seat.bookingSeats)
    @JoinColumn({ name: 'seat_id' })
    seat!: Seat;
}