import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { SubscriptionOrder } from './subscription-order.entity';
import { AccountBalance } from './account-balance.entity';
import { AccountTransaction } from './account-transaction.entity';

export enum UserRole {
  INVESTOR = 'investor',
  ADMIN = 'admin',
}

export enum UserStatus {
  PENDING = 'pending',    // 待审核
  APPROVED = 'approved',  // 已通过
  REJECTED = 'rejected',  // 已拒绝
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

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.APPROVED,  // 默认已通过（兼容现有用户）
  })
  status: UserStatus;

  @Column({ nullable: true })
  realName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true, comment: '审核备注' })
  reviewRemark: string;

  @Column({ nullable: true, comment: '审核时间' })
  reviewedAt: Date;

  @Column({ nullable: true, comment: '审核人ID' })
  reviewedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => SubscriptionOrder, (order) => order.user)
  subscriptionOrders: SubscriptionOrder[];

  @OneToOne(() => AccountBalance, (balance) => balance.user)
  accountBalance: AccountBalance;

  @OneToMany(() => AccountTransaction, (transaction) => transaction.user)
  accountTransactions: AccountTransaction[];
}
