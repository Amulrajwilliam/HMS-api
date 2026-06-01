import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Appointment } from '../../appointments/entities/appointment.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

export enum CheckInQueueStatus {
  WAITING = 'waiting',
  CALLED = 'called',
  IN_SERVICE = 'in_service',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show',
}

@Entity('visit_check_ins')
export class VisitCheckIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  tokenNumber: string;

  @Column({ type: 'date' })
  queueDate: string;

  @Column({ type: 'varchar', length: 64, default: 'OPD' })
  department: string;

  @Column({ type: 'enum', enum: CheckInQueueStatus, default: CheckInQueueStatus.WAITING })
  status: CheckInQueueStatus;

  @ManyToOne(() => Appointment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn()
  appointment: Appointment | null;

  @ManyToOne(() => Patient, { eager: true, nullable: false })
  @JoinColumn()
  patient: Patient;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn()
  doctor: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  checkedInAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  calledAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn()
  createdBy: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
