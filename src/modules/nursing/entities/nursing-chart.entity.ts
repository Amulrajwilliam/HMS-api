import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('nursing_flowsheet_entries')
export class NursingFlowsheetEntry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) patientId: string;
  @Column({ type: 'uuid', nullable: true }) recordedByUserId: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) shiftLabel: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) bloodPressure: string | null;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) temperature: number | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) pulseRate: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) respiratoryRate: string | null;
  @Column({ type: 'varchar', length: 16, nullable: true }) oxygenSaturation: string | null;
  @Column({ type: 'int', nullable: true }) painScore: number | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn() createdAt: Date;
}

export enum CarePlanStatus {
  ACTIVE = 'active',
  CLOSED = 'closed',
}

@Entity('nursing_care_plans')
export class NursingCarePlan {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) patientId: string;
  @Column({ type: 'text' }) problem: string;
  @Column({ type: 'text', nullable: true }) goal: string | null;
  @Column({ type: 'text', nullable: true }) intervention: string | null;
  @Column({ type: 'varchar', length: 16, default: CarePlanStatus.ACTIVE })
  status: CarePlanStatus;
  @Column({ type: 'uuid', nullable: true }) createdByUserId: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}

@Entity('nursing_ews_scores')
export class NursingEwsScore {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) patientId: string;
  @Column({ type: 'int' }) totalScore: number;
  @Column({ type: 'int', nullable: true }) respiratoryRate: number | null;
  @Column({ type: 'int', nullable: true }) spo2: number | null;
  @Column({ type: 'boolean', default: false }) supplementalO2: boolean;
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true }) temperature: number | null;
  @Column({ type: 'int', nullable: true }) systolicBp: number | null;
  @Column({ type: 'int', nullable: true }) pulse: number | null;
  @Column({ type: 'varchar', length: 8, nullable: true }) consciousness: string | null;
  @Column({ type: 'uuid', nullable: true }) recordedByUserId: string | null;
  @CreateDateColumn() createdAt: Date;
}

export enum EmarStatus {
  SCHEDULED = 'scheduled',
  GIVEN = 'given',
  HELD = 'held',
  MISSED = 'missed',
}

@Entity('emar_administrations')
export class EmarAdministration {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid' }) patientId: string;
  @Column({ type: 'varchar', length: 256 }) medicineName: string;
  @Column({ type: 'varchar', length: 128, nullable: true }) dose: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) route: string | null;
  @Column({ type: 'timestamptz', nullable: true }) scheduledAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) administeredAt: Date | null;
  @Column({ type: 'varchar', length: 16, default: EmarStatus.SCHEDULED })
  status: EmarStatus;
  @Column({ type: 'uuid', nullable: true }) administeredByUserId: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
