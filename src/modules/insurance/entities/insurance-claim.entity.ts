import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Invoice } from '../../billing/entities/invoice.entity';
import { User } from '../../users/entities/user.entity';

export enum InsuranceClaimStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  PROCESSING = 'processing',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SETTLED = 'settled',
}

@Entity('insurance_claims')
export class InsuranceClaim {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  claimNumber: string;

  @ManyToOne(() => Invoice, { eager: true })
  @JoinColumn()
  invoice: Invoice;

  @Column()
  providerName: string;

  @Column({ nullable: true })
  policyNumber: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  claimAmount: number;

  @Column({ type: 'simple-enum', enum: InsuranceClaimStatus, default: InsuranceClaimStatus.DRAFT })
  status: InsuranceClaimStatus;

  @Column({ nullable: true })
  externalClaimId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  denialReason: string | null;

  @Column({ type: 'text', nullable: true })
  appealNotes: string | null;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn()
  submittedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
