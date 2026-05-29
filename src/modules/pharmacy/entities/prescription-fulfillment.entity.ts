import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { Medicine } from './medicine.entity';

export enum FulfillmentStatus {
  PENDING = 'pending',
  DISPENSED = 'dispensed',
  CANCELLED = 'cancelled',
}

@Entity('prescription_fulfillments')
export class PrescriptionFulfillment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn()
  patient: Patient;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn()
  prescribedBy?: User | null;

  @ManyToOne(() => Medicine, { nullable: true, eager: true })
  @JoinColumn()
  medicine?: Medicine | null;

  @Column({ nullable: true })
  medicineName?: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ nullable: true })
  dose?: string;

  @Column({ type: 'text', nullable: true })
  instructions?: string;

  @Column({ nullable: true })
  sourceEmrRecordId?: string;

  @Column({ type: 'simple-enum', enum: FulfillmentStatus, default: FulfillmentStatus.PENDING })
  status: FulfillmentStatus;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn()
  fulfilledBy?: User | null;

  @Column({ nullable: true })
  fulfilledAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
