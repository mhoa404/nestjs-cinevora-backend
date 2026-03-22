import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity('refresh_tokens')
export class RefreshToken {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ name: 'user_id', type: 'uuid' })
    userId!: string;

    @Column({ length: 512, unique: true })
    token!: string;

    @Column({ name: 'expires_at', type: 'timestamp' })
    expiresAt!: Date;

    @Column({ name: 'is_revoked', type: 'boolean', default: false })
    isRevoked!: boolean;

    @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    //Relation
    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user!: User;

}
