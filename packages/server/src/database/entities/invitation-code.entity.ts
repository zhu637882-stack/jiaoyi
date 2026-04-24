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

@Entity('invitation_codes')
@Index(['code'], { unique: true })
export class InvitationCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 6, unique: true })
  code: string;

  @Column('int', { default: 0 })
  usedCount: number;

  @Column('int', { default: 50 })
  maxUses: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
