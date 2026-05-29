import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { Bed } from './bed.entity';

export enum AdmissionStatus {
  ADMITTED = 'admitted',
  TRANSFERRED = 'transferred',
  DISCHARGED = 'discharged',
}

@Entity('admissions')
export class Admission {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Patient, { eager: true, nullable: false })
  @JoinColumn() patient: Patient;

  @ManyToOne(() => Bed, (b) => b.admissions, { eager: true, nullable: false })
  @JoinColumn() bed: Bed;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn() admittingDoctor: User;

  @Column() admittedAt: Date;
  @Column({ nullable: true }) dischargedAt: Date;
  @Column({ type: 'text', nullable: true }) admissionDiagnosis: string;
  @Column({ type: 'text', nullable: true }) dischargeSummary: string;
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ type: 'enum', enum: AdmissionStatus, default: AdmissionStatus.ADMITTED })
  status: AdmissionStatus;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
