import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_events')
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userEmail: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  role: string | null;

  @Column({ type: 'varchar', length: 8 })
  method: string;

  @Column({ type: 'varchar', length: 2048 })
  path: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  ip: string | null;

  @Column({ type: 'int', default: 0 })
  durationMs: number;

  /** success | error */
  @Column({ type: 'varchar', length: 16, default: 'success' })
  outcome: string;

  @Column({ type: 'varchar', length: 512, nullable: true })
  errorSummary: string | null;
}
