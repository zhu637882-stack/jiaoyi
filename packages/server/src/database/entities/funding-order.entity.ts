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

export enum FundingOrderStatus {
  PENDING = 'pending',
  HOLDING = 'holding',
  PARTIAL_SETTLED = 'partial_settled',
  SETTLED = 'settled',
}

@Entity('funding_orders')
@Index(['drugId', 'status', 'fundedAt'])
export class FundingOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  orderNo: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  drugId: string;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column('int', { default: 0 })
  settledQuantity: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  unsettledAmount: number;

  @Column({
    type: 'enum',
    enum: FundingOrderStatus,
    default: FundingOrderStatus.PENDING,
  })
  status: FundingOrderStatus;

  @Column('int')
  queuePosition: number;

  @Column()
  fundedAt: Date;

  @Column({ nullable: true })
  settledAt: Date;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalProfit: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalLoss: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  totalInterest: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.fundingOrders)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => Drug, (drug) => drug.fundingOrders)
  @JoinColumn({ name: 'drugId' })
  drug: Drug;
}
