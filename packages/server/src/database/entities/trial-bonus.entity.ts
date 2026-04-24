import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum TrialBonusStatus {
  PENDING = 'pending',
  ACTIVATED = 'activated',
  USED = 'used',
  EXPIRED = 'expired',
}

@Entity('trial_bonuses')
@Index(['userId', 'createdAt'])
export class TrialBonus {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('decimal', { precision: 12, scale: 2, default: 20 })
  amount: number;

  @Column({
    type: 'enum',
    enum: TrialBonusStatus,
    default: TrialBonusStatus.PENDING,
  })
  status: TrialBonusStatus;

  @Column({ nullable: true })
  activatedAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
