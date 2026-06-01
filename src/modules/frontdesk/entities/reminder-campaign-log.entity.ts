import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum ReminderCampaignType {
  APPOINTMENT_TOMORROW = 'appointment_tomorrow',
  WAITLIST_SLOT = 'waitlist_slot',
  APPOINTMENT_DAY_OF = 'appointment_day_of',
}

@Entity('reminder_campaign_logs')
export class ReminderCampaignLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 48 })
  campaignType: ReminderCampaignType;

  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  @Column({ type: 'int', default: 0 })
  skippedCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  ranBy: User | null;

  @CreateDateColumn()
  ranAt: Date;
}
