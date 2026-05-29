import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum NotificationType {
  INFO = 'info',
  WARNING = 'warning',
  ALERT = 'alert',
  SUCCESS = 'success',
}

export enum NotificationModule {
  APPOINTMENTS = 'appointments',
  LAB = 'lab',
  PHARMACY = 'pharmacy',
  BILLING = 'billing',
  ADT = 'adt',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn() user: User;               // null = broadcast to all

  @Column() title: string;
  @Column({ type: 'text' }) message: string;
  @Column({ type: 'enum', enum: NotificationType, default: NotificationType.INFO }) type: NotificationType;
  @Column({ type: 'enum', enum: NotificationModule, default: NotificationModule.SYSTEM }) module: NotificationModule;
  @Column({ default: false }) isRead: boolean;
  @Column({ nullable: true }) actionUrl: string;  // deep-link to related page
  @Column({ nullable: true }) relatedId: string;  // FK to related record

  @CreateDateColumn() createdAt: Date;
}
