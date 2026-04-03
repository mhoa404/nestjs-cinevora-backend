import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserRole } from '../../../shared/constants/role.constant';
import { Booking } from '../../bookings/entities/booking.entity';

export enum UserSex {
  MAM = 'Nam',
  NU = 'Nữ',
  KHAC = 'Khác',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'full_name', length: 100 })
  fullName!: string;

  @Column({ length: 150, unique: true })
  email!: string;

  @Column({ length: 255 })
  password!: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth!: Date;

  @Column({ type: 'varchar', length: 15, unique: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  city!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  district!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  address!: string | null;

  @Column({
    type: 'enum',
    enum: UserSex,
    nullable: true,
  })
  sex!: UserSex | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role!: UserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt!: Date | null;

  @Column({
    name: 'created_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @Column({
    name: 'updated_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  //Relations
  @OneToMany(() => Booking, (booking) => booking.user)
  bookings!: Booking[];
}
