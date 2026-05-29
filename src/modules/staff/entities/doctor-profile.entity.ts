import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Department } from '../../admin/entities/department.entity';

/**
 * Clinical / directory fields for users with role doctor (1:1).
 * Admin maintains; exposed on GET /staff/doctors for booking UIs.
 */
@Entity('doctor_profiles')
export class DoctorProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @OneToOne(() => User, (u) => u.doctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 64, nullable: true })
  medicalRegistrationNo: string | null;

  @Column({ type: 'date', nullable: true })
  registrationExpiry: Date | null;

  /** Comma-separated or free-text list, e.g. "Cardiology, Internal Medicine" */
  @Column({ type: 'varchar', length: 512, nullable: true })
  specialties: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  qualification: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  department: string | null;

  @Column({ type: 'uuid', nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'departmentId' })
  departmentRef?: Department | null;

  @Column({ type: 'varchar', length: 32, default: 'none' })
  credentialingStatus: string;

  @Column({ type: 'text', nullable: true })
  credentialingNotes: string | null;

  @Column({ type: 'timestamp', nullable: true })
  credentialingReviewedAt: Date | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  consultationFee: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  languages: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  employeeId: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  designation: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  clinicalPhone: string | null;

  /** Clinic hours for slot generation (HH:mm). */
  @Column({ type: 'varchar', length: 8, default: '09:00' })
  clinicStartTime: string;

  @Column({ type: 'varchar', length: 8, default: '17:00' })
  clinicEndTime: string;

  @Column({ type: 'int', default: 30 })
  slotDurationMinutes: number;

  /** ISO weekdays 1=Mon … 7=Sun, comma-separated. */
  @Column({ type: 'varchar', length: 32, default: '1,2,3,4,5' })
  workingDays: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
