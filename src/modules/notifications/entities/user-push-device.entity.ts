import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('user_push_devices')
@Index(['userId', 'pushToken'], { unique: true })
export class UserPushDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 120, nullable: true })
  deviceId: string | null;

  @Column({ type: 'text' })
  pushToken: string;

  @Column({ type: 'varchar', length: 16, default: 'expo' })
  provider: 'expo' | 'fcm' | 'apns';

  @Column({ type: 'varchar', length: 16, nullable: true })
  platform: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
