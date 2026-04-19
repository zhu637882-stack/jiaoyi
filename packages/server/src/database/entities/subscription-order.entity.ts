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

/**
 * 零钱保认购订单状态
 * CONFIRMED: T+0已确认
 * EFFECTIVE: T+1已生效
 * RETURN_PENDING: 退回审核中（客户主动申请退回）
 * PARTIAL_RETURNED: 部分退回
 * RETURNED: 全部退回
 * CANCELLED: 已取消
 * SLOW_SELLING_REFUND: 滞销退款
 */
export enum SubscriptionOrderStatus {
  CONFIRMED = 'confirmed',
  EFFECTIVE = 'effective',
  RETURN_PENDING = 'return_pending',
  PARTIAL_RETURNED = 'partial_returned',
  RETURNED = 'returned',
  CANCELLED = 'cancelled',
  SLOW_SELLING_REFUND = 'slow_selling_refund',
}

@Entity('subscription_orders')
@Index(['drugId', 'status', 'effectiveAt'])
export class SubscriptionOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, comment: '订单号，前缀 SO' })
  orderNo: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  drugId: string;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column('int', { default: 0, comment: '已结算数量' })
  settledQuantity: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '未结算金额' })
  unsettledAmount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0, comment: '原始投入金额 = quantity * unitPrice' })
  originalAmount: number;

  @Column({
    type: 'simple-enum',
    enum: SubscriptionOrderStatus,
    default: SubscriptionOrderStatus.CONFIRMED,
  })
  status: SubscriptionOrderStatus;

  @Column('int', { comment: '排队位置' })
  queuePosition: number;

  @Column({ comment: 'T+0确认时间' })
  confirmedAt: Date;

  @Column({ comment: 'T+1生效时间' })
  effectiveAt: Date;

  @Column({ comment: '滞销截止日 = effectiveAt + 90天' })
  slowSellingDeadline: Date;

  @Column({ nullable: true, comment: '全部退回时间' })
  returnedAt: Date;

  @Column({ nullable: true, comment: '退回申请时间' })
  returnRequestedAt: Date;

  @Column('uuid', { nullable: true, comment: '退回核准人' })
  returnApprovedBy: string;

  @Column({ nullable: true, comment: '退回驳回原因' })
  returnRejectReason: string;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '累计收益' })
  totalProfit: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '累计亏损' })
  totalLoss: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.subscriptionOrders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Drug, (drug) => drug.subscriptionOrders)
  @JoinColumn({ name: 'drugId' })
  drug: Drug;
}
