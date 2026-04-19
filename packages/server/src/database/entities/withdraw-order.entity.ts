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

export enum WithdrawStatus {
  PENDING = 'pending',       // 出金中（待管理员确认）
  APPROVED = 'approved',     // 管理员已确认（银行已打款）
  REJECTED = 'rejected',     // 管理员驳回
}

@Entity('withdraw_orders')
@Index(['userId', 'createdAt'])
@Index(['status'])
export class WithdrawOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  orderNo: string;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column('decimal', { precision: 12, scale: 2 })
  balanceBefore: number;

  @Column({
    type: 'simple-enum',
    enum: WithdrawStatus,
    default: WithdrawStatus.PENDING,
  })
  status: WithdrawStatus;

  @Column('varchar', { length: 200, nullable: true })
  bankInfo: string;

  @Column('varchar', { length: 500, nullable: true })
  description: string;

  @Column('uuid', { nullable: true })
  approvedBy: string;

  @Column('timestamp', { nullable: true })
  approvedAt: Date;

  @Column('varchar', { length: 500, nullable: true })
  rejectReason: string;

  @Column('varchar', { length: 200, nullable: true })
  bankTransactionNo: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approvedBy' })
  approver: User;
}
