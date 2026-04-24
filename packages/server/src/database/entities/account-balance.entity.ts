import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('account_balances')
export class AccountBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  userId: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  availableBalance: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  frozenBalance: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalProfit: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalInvested: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '体验金余额' })
  trialBalance: number;

  @Column({ nullable: true, comment: '体验金过期时间' })
  trialExpiresAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.accountBalance)
  @JoinColumn({ name: 'userId' })
  user: User;
}
