import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { InvitationCode } from './invitation-code.entity';

export enum InvitationRecordStatus {
  REGISTERED = 'registered',
  SUBSCRIBED = 'subscribed',
  REWARDED = 'rewarded',
}

@Entity('invitation_records')
@Index(['inviterUserId', 'status'])
@Index(['inviteeUserId', 'status'])
export class InvitationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  inviterUserId: string;

  @Column('uuid')
  inviteeUserId: string;

  @Column('uuid')
  invitationCodeId: string;

  @Column({
    type: 'enum',
    enum: InvitationRecordStatus,
    default: InvitationRecordStatus.REGISTERED,
  })
  status: InvitationRecordStatus;

  @Column('decimal', { precision: 12, scale: 2, default: 10 })
  inviterReward: number;

  @Column('decimal', { precision: 12, scale: 2, default: 5 })
  inviteeReward: number;

  @Column({ nullable: true })
  rewardedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviterUserId' })
  inviter: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviteeUserId' })
  invitee: User;

  @ManyToOne(() => InvitationCode)
  @JoinColumn({ name: 'invitationCodeId' })
  invitationCode: InvitationCode;
}
