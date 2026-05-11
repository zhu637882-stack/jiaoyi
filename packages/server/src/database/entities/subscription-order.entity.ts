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
 * 认购订单状态
 * CONFIRMED: T+0已确认
 * EFFECTIVE: T+1已生效
 * RETURN_PENDING: 退回审核中（客户主动申请退回）
 * PARTIAL_RETURNED: 部分退回
 * RETURNED: 全部退回
 * CANCELLED: 已取消
 * SLOW_SELLING_REFUND: 滞销退款
 * SETTLED: 到期已结算（10天期限到期，管理员手动截止处理）
 * PARTIAL_SOLD: 部分售出
 * FULLY_SOLD: 全部售出
 * SETTLING: 回款中
 * RETURNED_TO_STOCK: 退货回库
 */
export enum SubscriptionOrderStatus {
  CONFIRMED = 'confirmed',
  EFFECTIVE = 'effective',
  RETURN_PENDING = 'return_pending',
  PARTIAL_RETURNED = 'partial_returned',
  RETURNED = 'returned',
  CANCELLED = 'cancelled',
  SLOW_SELLING_REFUND = 'slow_selling_refund',
  SETTLED = 'settled',
  PARTIAL_SOLD = 'partial_sold',
  FULLY_SOLD = 'fully_sold',
  SETTLING = 'settling',
  RETURNED_TO_STOCK = 'returned_to_stock',
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

  @Column('int', { default: 0, comment: '管理员确认数量' })
  confirmedQuantity: number;

  @Column('int', { default: 0, comment: '待确认数量（quantity - confirmedQuantity）' })
  unconfirmedQuantity: number;

  @Column({ type: 'timestamp', nullable: true, comment: '部分确认时间（未确认部分开始计时）' })
  unconfirmedAt: Date;

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

  @Column({ nullable: true, comment: 'T+1生效时间（审核通过时设置）' })
  effectiveAt: Date;

  @Column({ nullable: true, comment: '滞销截止日 = effectiveAt + 90天（审核通过时设置）' })
  slowSellingDeadline: Date;

  @Column({ nullable: true, comment: '全部退回时间' })
  returnedAt: Date;

  @Column({ nullable: true, comment: '退回申请时间' })
  returnRequestedAt: Date;

  @Column('uuid', { nullable: true, comment: '退回核准人' })
  returnApprovedBy: string;

  @Column({ nullable: true, comment: '退回驳回原因' })
  returnRejectReason: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  auditStatus: 'pending' | 'approved' | 'rejected';  // 审核状态

  @Column({ type: 'timestamp', nullable: true })
  auditAt: Date;  // 审核时间

  @Column({ nullable: true })
  auditBy: string;  // 审核人（管理员ID）

  @Column({ type: 'text', nullable: true })
  auditRemark: string;  // 审核备注

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '累计收益' })
  totalProfit: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '累计亏损' })
  totalLoss: number;

  @Column({ type: 'int', default: 0, comment: '已售出数量（累计）' })
  soldQuantity: number;

  @Column({ type: 'timestamp', nullable: true, comment: '首次售出时间' })
  firstSoldAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '最近一次售出时间' })
  lastSoldAt: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '锁定期截止日（effectiveAt + 10天）' })
  lockExpiresAt: Date;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '分红金额（财务手动填写）' })
  dividendAmount: number;

  @Column({ type: 'varchar', nullable: true, comment: '填写分红的管理员' })
  dividendFilledBy: string;

  @Column({ type: 'timestamp', nullable: true, comment: '分红填写时间' })
  dividendFilledAt: Date;

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
