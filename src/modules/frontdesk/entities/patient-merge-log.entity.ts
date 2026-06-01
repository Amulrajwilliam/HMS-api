import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';

@Entity('patient_merge_logs')
export class PatientMergeLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Patient, { nullable: false })
  @JoinColumn()
  survivorPatient: Patient;

  @Column({ type: 'uuid' })
  mergedPatientId: string;

  @Column({ type: 'varchar', length: 32 })
  mergedUhid: string;

  @Column({ type: 'jsonb', nullable: true })
  mergedSnapshot: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn()
  mergedBy: User;

  @CreateDateColumn()
  createdAt: Date;
}
