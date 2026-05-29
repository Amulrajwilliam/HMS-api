import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum MedicineCategory {
  TABLET = 'tablet',
  CAPSULE = 'capsule',
  SYRUP = 'syrup',
  INJECTION = 'injection',
  OINTMENT = 'ointment',
  DROPS = 'drops',
  INHALER = 'inhaler',
  OTHER = 'other',
}

@Entity('medicines')
export class Medicine {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ nullable: true }) genericName: string;
  @Column({ nullable: true }) manufacturer: string;
  @Column({ type: 'enum', enum: MedicineCategory, default: MedicineCategory.TABLET }) category: MedicineCategory;
  @Column({ nullable: true }) unit: string;          // e.g. mg, ml
  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0 }) price: number;
  @Column({ default: 0 }) stock: number;             // current quantity
  @Column({ default: 10 }) reorderLevel: number;     // alert when below this
  @Column({ nullable: true }) batchNumber: string;
  @Column({ type: 'date', nullable: true }) expiryDate: string;
  @Column({ default: true }) isActive: boolean;
  @Column({ nullable: true }) location: string;       // shelf/rack location

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
