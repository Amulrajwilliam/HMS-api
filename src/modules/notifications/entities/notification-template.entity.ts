import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { NotificationModule, NotificationType } from './notification.entity';

@Entity('notification_templates')
export class NotificationTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 120 })
  key: string;

  @Column({ length: 200 })
  titleTemplate: string;

  @Column({ type: 'text' })
  messageTemplate: string;

  @Column({ type: 'simple-enum', enum: NotificationType, default: NotificationType.INFO })
  defaultType: NotificationType;

  @Column({ type: 'simple-enum', enum: NotificationModule, default: NotificationModule.SYSTEM })
  defaultModule: NotificationModule;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
