import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Drug } from './drug.entity';

export enum SettlementStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('settlements')
@Index(['drugId', 'settlementDate'])
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  drugId: string;

  @Column('date')
  settlementDate: Date;

  @Column('int', { comment: '当日销售数量' })
  totalSalesQuantity: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalSalesRevenue: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalCost: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalFees: number;

  @Column('decimal', { precision: 12, scale: 2, default: 0, comment: '运营费用' })
  operationFees: number;

  @Column('decimal', { precision: 12, scale: 2 })
  netProfit: number;

  @Column('decimal', { precision: 12, scale: 2 })
  investorProfitShare: number;

  @Column('decimal', { precision: 12, scale: 2 })
  platformProfitShare: number;

  @Column('decimal', { precision: 12, scale: 2 })
  investorLossShare: number;

  @Column('decimal', { precision: 12, scale: 2 })
  platformLossShare: number;

  @Column('decimal', { precision: 12, scale: 2, comment: '退回本金' })
  returnedPrincipal: number;

  @Column('int')
  settledOrderCount: number;

  @Column({
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.PROCESSING,
  })
  status: SettlementStatus;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Drug, (drug) => drug.settlements)
  @JoinColumn({ name: 'drugId' })
  drug: Drug;
}
