import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { FundingOrder } from './funding-order.entity';
import { AccountBalance } from './account-balance.entity';
import { AccountTransaction } from './account-transaction.entity';

export enum UserRole {
  INVESTOR = 'investor',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.INVESTOR,
  })
  role: UserRole;

  @Column({ nullable: true })
  realName: string;

  @Column({ nullable: true })
  phone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => FundingOrder, (order) => order.user)
  fundingOrders: FundingOrder[];

  @OneToOne(() => AccountBalance, (balance) => balance.user)
  accountBalance: AccountBalance;

  @OneToMany(() => AccountTransaction, (transaction) => transaction.user)
  accountTransactions: AccountTransaction[];
}
