import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { SubscriptionOrder } from './subscription-order.entity';

@Entity('sale_records')
export class SaleRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => SubscriptionOrder)
  @JoinColumn({ name: 'orderId' })
  order: SubscriptionOrder;

  @Column({ type: 'int' })
  quantity: number; // 本次售出数量

  @CreateDateColumn()
  recordedAt: Date; // 录入时间

  @Column({ type: 'timestamp' })
  settlementDueAt: Date; // 结算到期时间（录入日+10天）

  @Column({ type: 'boolean', default: false })
  settled: boolean; // 是否已结算

  @Column({ type: 'timestamp', nullable: true })
  settledAt: Date; // 实际结算时间

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  saleAmount: number; // 售出金额 = quantity × sellingPrice

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  profitAmount: number; // 资方利润 = saleAmount × 1.8%

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subsidyAmount: number; // 滞销补贴金额（结算时计算填入）
}
