import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Room } from '../../rooms/entities/room.entity';

@Entity('cinemas')
export class Cinema {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 150 })
  name!: string;

  @Column({ length: 255 })
  address!: string;

  @Column({ length: 50 })
  city!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  district!: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  phone!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  //relation
  @OneToMany(() => Room, (room) => room.cinema)
  rooms!: Room[];
}
