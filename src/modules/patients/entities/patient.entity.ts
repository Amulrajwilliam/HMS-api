import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
} from 'typeorm';

export enum Gender { MALE = 'male', FEMALE = 'female', OTHER = 'other' }
export enum BloodGroup { A_POS = 'A+', A_NEG = 'A-', B_POS = 'B+', B_NEG = 'B-', AB_POS = 'AB+', AB_NEG = 'AB-', O_POS = 'O+', O_NEG = 'O-' }
export enum PatientStatus { ACTIVE = 'active', ADMITTED = 'admitted', DISCHARGED = 'discharged', INACTIVE = 'inactive' }

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ unique: true }) uhid: string;          // UHID-0001

  @Column() name: string;
  @Column({ type: 'date' }) dob: string;
  @Column({ type: 'simple-enum', enum: Gender }) gender: Gender;
  @Column({ type: 'simple-enum', enum: BloodGroup, nullable: true }) bloodGroup: BloodGroup;

  @Column({ unique: true }) phone: string;
  @Column({ nullable: true }) email: string;
  @Column({ nullable: true, unique: true }) userId: string;
  @Column({ type: 'text', nullable: true }) address: string;

  @Column({ nullable: true }) emergencyName: string;
  @Column({ nullable: true }) emergencyPhone: string;
  @Column({ nullable: true }) emergencyRelation: string;

  @Column({ nullable: true }) allergies: string;
  @Column({ type: 'text', nullable: true }) notes: string;

  @Column({ type: 'simple-enum', enum: PatientStatus, default: PatientStatus.ACTIVE }) status: PatientStatus;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
  @DeleteDateColumn() deletedAt: Date;
}
