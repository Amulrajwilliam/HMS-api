import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/** Single-row JSON settings for Hospital Settings UI (general, branding, notifications, security). */
@Entity('hospital_app_settings')
export class HospitalAppSettings {
  @PrimaryColumn({ type: 'varchar', length: 32, default: 'singleton' })
  id: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  settings: Record<string, unknown>;

  @UpdateDateColumn()
  updatedAt: Date;
}
