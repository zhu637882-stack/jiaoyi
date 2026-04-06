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
import { Drug } from './drug.entity';

export enum PendingOrderType {
  LIMIT_BUY = 'limit_buy',
  LIMIT_SELL = 'limit_sell',
}

export enum PendingOrderStatus {
  PENDING = 'pending',
  TRIGGERED = 'triggered',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PARTIAL = 'partial',
}

@Entity('pending_orders')
@Index(['drugId', 'status', 'createdAt'])
@Index(['userId', 'status'])
@Index('IDX_pending_orders_status_expireAt', ['status', 'expireAt'])
export class PendingOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderNo: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  drugId: string;

  @Column({ type: 'enum', enum: PendingOrderType })
  type: PendingOrderType;

  @Column('decimal', { precision: 10, scale: 2 })
  targetPrice: number;

  @Column('int')
  quantity: number;

  @Column('int', { default: 0 })
  filledQuantity: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  frozenAmount: number;

  @Column({
    type: 'enum',
    enum: PendingOrderStatus,
    default: PendingOrderStatus.PENDING,
  })
  status: PendingOrderStatus;

  @Column({ nullable: true })
  expireAt: Date;

  @Column({ nullable: true })
  triggeredAt: Date;

  @Column('uuid', { nullable: true })
  fundingOrderId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Drug)
  @JoinColumn({ name: 'drugId' })
  drug: Drug;
}
