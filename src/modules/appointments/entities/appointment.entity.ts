import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled', CONFIRMED = 'confirmed', COMPLETED = 'completed',
  CANCELLED = 'cancelled', NO_SHOW = 'no_show',
}
export enum AppointmentType {
  NEW_PATIENT = 'new_patient', FOLLOW_UP = 'follow_up',
  CONSULTATION = 'consultation', PROCEDURE = 'procedure',
  TELEVISIT = 'televisit',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Patient, { eager: true, nullable: false })
  @JoinColumn() patient: Patient;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn() doctor: User;

  @Column({ type: 'date' }) date: string;
  @Column({ type: 'time' }) time: string;

  @Column({ type: 'enum', enum: AppointmentType, default: AppointmentType.CONSULTATION })
  type: AppointmentType;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
  status: AppointmentStatus;

  @Column({ nullable: true }) department: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ type: 'text', nullable: true }) cancellationReason: string;

  @Column({ type: 'varchar', length: 512, nullable: true }) televisitUrl: string | null;

  @Column({ type: 'text', nullable: true }) televisitInstructions: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
