import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm'

@Entity('audit_logs')
@Index('IDX_audit_logs_userId_createdAt', ['userId', 'createdAt'])
@Index('IDX_audit_logs_action', ['action'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ nullable: true })
  userId: string

  @Column()
  action: string  // LOGIN, PRICE_UPDATE, FORCE_CANCEL, SETTLEMENT, RECHARGE, WITHDRAW, SELL

  @Column({ nullable: true })
  targetType: string  // drug, pending_order, user, account

  @Column({ nullable: true })
  targetId: string

  @Column({ type: 'text', nullable: true })
  detail: string  // JSON string

  @Column({ nullable: true })
  ipAddress: string

  @CreateDateColumn()
  createdAt: Date
}
