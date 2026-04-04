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

@Entity('market_snapshots')
@Index(['drugId', 'snapshotDate'])
export class MarketSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  drugId: string;

  @Column('date')
  snapshotDate: Date;

  @Column('int')
  dailySalesQuantity: number;

  @Column('decimal', { precision: 12, scale: 2 })
  dailySalesRevenue: number;

  @Column('decimal', { precision: 10, scale: 2 })
  averageSellingPrice: number;

  @Column('decimal', { precision: 8, scale: 4 })
  dailyReturn: number;

  @Column('decimal', { precision: 8, scale: 4 })
  cumulativeReturn: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalFundingAmount: number;

  @Column('int')
  fundingHeat: number;

  @Column('int')
  queueDepth: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Drug, (drug) => drug.marketSnapshots)
  @JoinColumn({ name: 'drugId' })
  drug: Drug;
}
