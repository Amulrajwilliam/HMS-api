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

export enum ProblemStatus {
  ACTIVE = 'active',
  RESOLVED = 'resolved',
}

@Entity('patient_problems')
export class PatientProblem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'varchar', length: 32, nullable: true })
  icdCode: string | null;

  @Column({ type: 'text' }) description: string;

  @Column({ type: 'enum', enum: ProblemStatus, default: ProblemStatus.ACTIVE })
  status: ProblemStatus;

  @Column({ type: 'date', nullable: true }) onsetDate: string | null;

  @Column({ type: 'uuid', nullable: true }) createdByUserId: string | null;

  @Column({ type: 'timestamptz', nullable: true }) resolvedAt: Date | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
