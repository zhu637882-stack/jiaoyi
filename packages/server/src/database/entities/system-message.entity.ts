import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

export enum MessageType {
  ANNOUNCEMENT = 'announcement',  // 平台公告
  NOTIFICATION = 'notification',  // 系统通知
  MAINTENANCE = 'maintenance',    // 维护通知
}

export enum MessageStatus {
  DRAFT = 'draft',        // 草稿
  PUBLISHED = 'published', // 已发布
  ARCHIVED = 'archived',   // 已归档
}

@Entity('system_messages')
@Index('IDX_system_messages_status_createdAt', ['status', 'createdAt'])
export class SystemMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  title: string

  @Column({ type: 'text' })
  content: string

  @Column({ type: 'enum', enum: MessageType, default: MessageType.ANNOUNCEMENT })
  type: MessageType

  @Column({ type: 'enum', enum: MessageStatus, default: MessageStatus.DRAFT })
  status: MessageStatus

  @Column({ nullable: true })
  publishedBy: string  // 发布者userId

  @Column({ nullable: true })
  publishedAt: Date

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
