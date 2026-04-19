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

export enum PaymentChannel {
  ALIPAY = 'alipay',
  WECHAT = 'wechat',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  EXPIRED = 'expired',
}

@Entity('payment_orders')
@Index(['userId', 'createdAt'])
@Index(['outTradeNo'])
export class PaymentOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  outTradeNo: string;

  @Column({
    type: 'enum',
    enum: PaymentChannel,
  })
  channel: PaymentChannel;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column('varchar', { length: 64, nullable: true })
  tradeNo: string;

  @Column('timestamp', { nullable: true })
  paidAt: Date;

  @Column('text', { nullable: true })
  notifyData: string;

  /** 认购直付信息：{ drugId, quantity, amount }，为空则走充值余额流程 */
  @Column('simple-json', { nullable: true, comment: '认购直付信息' })
  subscriptionInfo: { drugId: string; quantity: number; amount: number } | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
