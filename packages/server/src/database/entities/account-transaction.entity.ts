import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum TransactionType {
  RECHARGE = 'recharge',
  WITHDRAW = 'withdraw',
  FUNDING = 'funding',
  PRINCIPAL_RETURN = 'principal_return',
  PROFIT_SHARE = 'profit_share',
  LOSS_SHARE = 'loss_share',
  INTEREST = 'interest',
  SELL = 'sell',
}

@Entity('account_transactions')
@Index(['userId', 'createdAt'])
export class AccountTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column('decimal', { precision: 12, scale: 2 })
  balanceBefore: number;

  @Column('decimal', { precision: 12, scale: 2 })
  balanceAfter: number;

  @Column('uuid', { nullable: true })
  relatedOrderId: string;

  @Column('uuid', { nullable: true })
  relatedSettlementId: string;

  @Column()
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, (user) => user.accountTransactions)
  @JoinColumn({ name: 'userId' })
  user: User;
}
