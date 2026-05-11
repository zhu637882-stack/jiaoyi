import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { SubscriptionOrder } from './subscription-order.entity';
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

  @Column('decimal', { precision: 10, scale: 2, default: 0, comment: '昨日实际成交价，作为今日估价' })
  actualSellingPrice: number;

  @Column({ nullable: true, comment: '实际成交价更新日期' })
  actualPriceUpdatedAt: Date;

  @Column('int')
  totalQuantity: number;

  @Column('int', { default: 0, comment: '已认购数量' })
  subscribedQuantity: number;

  @Column()
  batchNo: string;

  @Column({
    type: 'enum',
    enum: DrugStatus,
    default: DrugStatus.PENDING,
  })
  status: DrugStatus;

  @Column('decimal', { precision: 10, scale: 2, default: 0, comment: '运营费用比例（百分比数值，如1.00表示1%）' })
  operationFeeRate: number;

  @Column('int', { default: 10, comment: '滞销天数' })
  slowSellingDays: number;

  @Column({ type: 'boolean', default: false, comment: '是否冷链药品（冷链快递费20元，普通3元）' })
  isColdChain: boolean;

  @Column({ nullable: true, comment: '产品图片URL' })
  imageUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => SubscriptionOrder, (order) => order.drug)
  subscriptionOrders: SubscriptionOrder[];

  @OneToMany(() => DailySales, (sales) => sales.drug)
  dailySales: DailySales[];

  @OneToMany(() => Settlement, (settlement) => settlement.drug)
  settlements: Settlement[];

  @OneToMany(() => MarketSnapshot, (snapshot) => snapshot.drug)
  marketSnapshots: MarketSnapshot[];

  get remainingQuantity(): number {
    return this.totalQuantity - this.subscribedQuantity;
  }
}
