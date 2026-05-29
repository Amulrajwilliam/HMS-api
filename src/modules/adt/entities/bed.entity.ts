import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  OneToMany, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Ward } from './ward.entity';
import { Admission } from './admission.entity';

export enum BedStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance',
  RESERVED = 'reserved',
}

@Entity('beds')
export class Bed {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() bedNumber: string;

  @ManyToOne(() => Ward, (w) => w.beds, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn() ward: Ward;

  @Column({ type: 'enum', enum: BedStatus, default: BedStatus.AVAILABLE }) status: BedStatus;
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 }) pricePerDay: number;
  @Column({ nullable: true }) bedType: string; // e.g. standard, deluxe, AC

  @OneToMany(() => Admission, (a) => a.bed)
  admissions: Admission[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
