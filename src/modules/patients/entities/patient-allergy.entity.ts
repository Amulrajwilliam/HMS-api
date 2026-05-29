import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';

export enum AllergyStatus {
  ACTIVE = 'active',
  UNCONFIRMED = 'unconfirmed',
  REFUTED = 'refuted',
}

export enum AllergySource {
  PATIENT_REPORTED = 'patient_reported',
  CLINICIAN = 'clinician',
  IMPORTED = 'imported',
}

@Entity('patient_allergies')
export class PatientAllergy {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'varchar', length: 256 }) substance: string;

  @Column({ type: 'text', nullable: true }) reaction: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true }) severity: string | null;

  @Column({ type: 'enum', enum: AllergyStatus, default: AllergyStatus.ACTIVE })
  status: AllergyStatus;

  @Column({ type: 'enum', enum: AllergySource, default: AllergySource.CLINICIAN })
  source: AllergySource;

  @Column({ type: 'timestamptz', nullable: true }) reconciledAt: Date | null;

  @Column({ type: 'uuid', nullable: true }) reconciledByUserId: string | null;

  @Column({ type: 'uuid', nullable: true }) recordedByUserId: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
