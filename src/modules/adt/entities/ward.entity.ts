import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Bed } from './bed.entity';

export enum WardType {
  GENERAL = 'general',
  ICU = 'icu',
  EMERGENCY = 'emergency',
  PEDIATRIC = 'pediatric',
  MATERNITY = 'maternity',
  SURGICAL = 'surgical',
  ORTHOPEDIC = 'orthopedic',
}

@Entity('wards')
export class Ward {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'enum', enum: WardType, default: WardType.GENERAL }) type: WardType;
  @Column() floor: string;
  @Column({ default: 0 }) totalBeds: number;
  @Column({ type: 'text', nullable: true }) description: string;
  @Column({ default: true }) isActive: boolean;

  @OneToMany(() => Bed, (bed) => bed.ward, { cascade: true })
  beds: Bed[];

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
