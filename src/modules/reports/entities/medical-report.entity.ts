import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

export enum MedicalReportType {
  LAB_PDF = 'lab_pdf',
  RADIOLOGY = 'radiology',
  DICOM = 'dicom',
  OTHER = 'other',
}

export enum ReportStorageProvider {
  LOCAL = 'local',
  S3 = 's3',
}

@Entity('medical_reports')
export class MedicalReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'simple-enum', enum: MedicalReportType, default: MedicalReportType.OTHER })
  reportType: MedicalReportType;

  @Column({ type: 'simple-enum', enum: ReportStorageProvider })
  storageProvider: ReportStorageProvider;

  /** Relative storage key (S3 object key or local subpath under uploads/reports). */
  @Column()
  storageKey: string;

  /** Set when storageProvider is S3; explicit type avoids reflect-metadata inferring Object on string | null. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  s3Bucket: string | null;

  @Column()
  originalFilename: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint', default: 0 })
  fileSize: number;

  @Column({ type: 'uuid', nullable: true })
  patientId: string | null;

  @ManyToOne(() => Patient, { nullable: true, eager: true })
  @JoinColumn({ name: 'patientId' })
  patient?: Patient | null;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn()
  uploadedBy?: User | null;

  @CreateDateColumn()
  createdAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
