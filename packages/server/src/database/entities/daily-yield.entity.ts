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
import { SubscriptionOrder } from './subscription-order.entity';

@Entity('daily_yields')
@Index(['orderId', 'yieldDate'], { unique: true })
@Index(['userId', 'yieldDate'])
@Index(['drugId', 'yieldDate'])
export class DailyYield {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { comment: '认购订单ID' })
  orderId: string;

  @Column('uuid', { comment: '用户ID' })
  userId: string;

  @Column('uuid', { comment: '药品ID' })
  drugId: string;

  @Column('date', { comment: '收益日期' })
  yieldDate: Date;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '基础收益 = 本金 × 5% / 365' })
  baseYield: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '补贴金（财务手动填写）' })
  subsidy: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '当日总收益 = baseYield + subsidy' })
  totalYield: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '当日本金余额' })
  principalBalance: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '累计收益（截至当天）' })
  cumulativeYield: number;

  @Column('boolean', { default: false, comment: '补贴金是否已填写' })
  subsidyFilled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => SubscriptionOrder, (order) => order.id)
  @JoinColumn({ name: 'orderId' })
  order: SubscriptionOrder;

  @ManyToOne(() => User, (user) => user.id)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Drug, (drug) => drug.id)
  @JoinColumn({ name: 'drugId' })
  drug: Drug;
}
