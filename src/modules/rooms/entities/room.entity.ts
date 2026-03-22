import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Cinema } from "../../cinemas/entities/cinema.entity";
import { Showtime } from "../../showtimes/entities/showtime.entity";
import { Seat } from "../../seats/entities/seat.entity";

@Entity('rooms')
export class Room {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'cinema_id' })
    cinemaId!: number;

    @Column({ length: 20 })
    name!: string;

    @Column({ name: 'total_seats', type: 'int' })
    totalSeats!: number;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    //relation
    @ManyToOne(() => Cinema, (cinema) => cinema.rooms)
    @JoinColumn({ name: 'cinema_id' })
    cinema!: Cinema;

    @OneToMany(() => Showtime, (showtime) => showtime.room)
    showtimes!: Showtime[];

    @OneToMany(() => Seat, (seat) => seat.room)
    seats!: Seat[];
}
