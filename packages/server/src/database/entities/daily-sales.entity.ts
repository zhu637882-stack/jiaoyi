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

@Entity('daily_sales')
@Index(['drugId', 'saleDate'])
export class DailySales {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  drugId: string;

  @Column('date')
  saleDate: Date;

  @Column('int')
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  actualSellingPrice: number;

  @Column('decimal', { precision: 12, scale: 2 })
  totalRevenue: number;

  @Column()
  terminal: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Drug, (drug) => drug.dailySales)
  @JoinColumn({ name: 'drugId' })
  drug: Drug;
}
