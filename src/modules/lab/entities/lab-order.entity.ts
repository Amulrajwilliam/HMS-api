import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

export enum LabOrderStatus {
  PENDING = 'pending',
  SAMPLE_COLLECTED = 'sample_collected',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum LabOrderPriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  STAT = 'stat',
}

@Entity('lab_orders')
export class LabOrder {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) orderNumber: string;

  @ManyToOne(() => Patient, { eager: true, nullable: false })
  @JoinColumn() patient: Patient;

  @ManyToOne(() => User, { eager: true, nullable: true })
  @JoinColumn() doctor: User;

  @Column({ type: 'enum', enum: LabOrderStatus, default: LabOrderStatus.PENDING })
  status: LabOrderStatus;

  @Column({ type: 'enum', enum: LabOrderPriority, default: LabOrderPriority.ROUTINE })
  priority: LabOrderPriority;

  // Tests requested (array of {testName, testCode})
  @Column({ type: 'jsonb', default: [] })
  tests: { testName: string; testCode: string; price: number }[];

  // Results once completed
  @Column({ type: 'jsonb', nullable: true })
  results: { testName: string; value: string; unit: string; normalRange: string; flag: string }[];

  @Column({ nullable: true }) sampleCollectedAt: Date;
  @Column({ nullable: true }) sampleBarcode: string;
  @Column({ nullable: true }) reportReadyAt: Date;
  @Column({ nullable: true }) sampleType: string;      // blood, urine, stool
  @Column({ type: 'text', nullable: true }) notes: string;
  @Column({ type: 'text', nullable: true }) remarks: string;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
