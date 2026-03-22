import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";
import { Showtime } from "../../showtimes/entities/showtime.entity";
import { BookingSeat } from "./booking-seat.entity";

export enum BookingStatus {
    PENDING = 'pending',
    CONFIRMED = 'confirmed',
    CANCELLED = 'cancelled',
    USED = 'used',
}

export enum PaymentMethod {
    CASH = 'cash',
    MOMO = 'momo',
    ZALOPAY = 'zalopay',
    CREDIT_CARD = 'credit_card',
}

@Entity('bookings')
export class Booking {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'user_id' })
    userId!: string;

    @Column({ name: 'showtime_id' })
    showtimeId!: number;

    @Column({ name: 'ticket_count', type: 'int' })
    ticketCount!: number;

    @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 0 })
    totalPrice!: number;

    @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
    paymentMethod!: PaymentMethod;

    @Column({ name: 'booked_at', type: 'timestamp' })
    bookedAt!: Date;

    @Column({ name: 'status', type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
    status!: BookingStatus;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    //Relation
    @ManyToOne(() => User, (user) => user.bookings)
    @JoinColumn({ name: 'user_id' })
    user!: User;

    @ManyToOne(() => Showtime, (showtime) => showtime.bookings)
    @JoinColumn({ name: 'showtime_id' })
    showtime!: Showtime;

    @OneToMany(() => BookingSeat, (bookingSeat) => bookingSeat.booking)
    bookingSeats!: BookingSeat[];
}