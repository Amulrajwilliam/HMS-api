import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';

@Entity('emr_records')
export class EmrRecord {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Patient, { eager: true, nullable: false })
  @JoinColumn() patient: Patient;

  @ManyToOne(() => User, { eager: true, nullable: false })
  @JoinColumn() doctor: User;

  @ManyToOne(() => Appointment, { nullable: true, eager: false })
  @JoinColumn() appointment: Appointment;

  // Vitals
  @Column({ nullable: true }) bloodPressure: string;   // e.g. "120/80"
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) temperature: number;  // °F
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) weight: number;       // kg
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) height: number;       // cm
  @Column({ nullable: true }) pulseRate: string;       // bpm
  @Column({ nullable: true }) oxygenSaturation: string; // SpO2 %
  @Column({ nullable: true }) respiratoryRate: string;

  // Consultation
  @Column({ type: 'text', nullable: true }) chiefComplaint: string;
  @Column({ type: 'text', nullable: true }) historyOfPresentIllness: string;
  @Column({ type: 'text', nullable: true }) physicalExamination: string;
  @Column({ type: 'text', nullable: true }) diagnosis: string;
  @Column({ type: 'text', nullable: true }) differentialDiagnosis: string;
  @Column({ type: 'text', nullable: true }) treatmentPlan: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ type: 'text', nullable: true }) followUpInstructions: string;

  // Prescriptions (stored as JSON array)
  @Column({ type: 'jsonb', nullable: true, default: [] })
  prescriptions: {
    drug: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string;
  }[];

  @Column({ type: 'date', nullable: true }) followUpDate: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
