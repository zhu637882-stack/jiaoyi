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
  USER = 'user',          // 普通客户
  VIEWER = 'viewer',      // 只读管理员
  MANAGER = 'manager',    // 普通管理员
  ADMIN = 'admin',        // 超级管理员
  // 兼容旧值
  INVESTOR = 'user',      // 已废弃，等同于USER
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
    type: 'varchar',
    default: UserRole.USER,
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

  @Column({ nullable: true, comment: '微信公众号OpenID' })
  wechatOpenId: string;

  @Column({ type: 'boolean', default: false, comment: '是否同意服务协议' })
  agreedToAgreement: boolean;

  @Column({ type: 'integer', default: 0, comment: '登录次数' })
  loginCount: number;

  @Column({ type: 'timestamp', nullable: true, comment: '同意协议时间' })
  agreedAt: Date;

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
