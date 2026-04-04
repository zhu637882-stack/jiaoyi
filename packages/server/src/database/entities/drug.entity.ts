import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FundingOrder } from './funding-order.entity';
import { DailySales } from './daily-sales.entity';
import { Settlement } from './settlement.entity';
import { MarketSnapshot } from './market-snapshot.entity';

export enum DrugStatus {
  PENDING = 'pending',
  FUNDING = 'funding',
  SELLING = 'selling',
  COMPLETED = 'completed',
}

@Entity('drugs')
export class Drug {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @Column('decimal', { precision: 10, scale: 2 })
  purchasePrice: number;

  @Column('decimal', { precision: 10, scale: 2 })
  sellingPrice: number;

  @Column('int')
  totalQuantity: number;

  @Column('int', { default: 0 })
  fundedQuantity: number;

  @Column()
  batchNo: string;

  @Column({
    type: 'enum',
    enum: DrugStatus,
    default: DrugStatus.PENDING,
  })
  status: DrugStatus;

  @Column('decimal', { precision: 5, scale: 2, default: 5.0 })
  annualRate: number;

  @Column('decimal', { precision: 10, scale: 2, default: 1.0 })
  unitFee: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => FundingOrder, (order) => order.drug)
  fundingOrders: FundingOrder[];

  @OneToMany(() => DailySales, (sales) => sales.drug)
  dailySales: DailySales[];

  @OneToMany(() => Settlement, (settlement) => settlement.drug)
  settlements: Settlement[];

  @OneToMany(() => MarketSnapshot, (snapshot) => snapshot.drug)
  marketSnapshots: MarketSnapshot[];

  get remainingQuantity(): number {
    return this.totalQuantity - this.fundedQuantity;
  }
}
