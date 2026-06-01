import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

export enum WaitlistStatus {
  WAITING = 'waiting',
  NOTIFIED = 'notified',
  BOOKED = 'booked',
  CANCELLED = 'cancelled',
}

@Entity('appointment_waitlist')
export class AppointmentWaitlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { eager: true, nullable: false })
  @JoinColumn()
  patient: Patient;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn()
  doctor: User;

  @Column({ type: 'varchar', length: 64, nullable: true })
  department: string | null;

  @Column({ type: 'date', nullable: true })
  preferredDate: string | null;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'enum', enum: WaitlistStatus, default: WaitlistStatus.WAITING })
  status: WaitlistStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastNotifiedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
