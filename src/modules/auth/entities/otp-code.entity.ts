import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('otp_codes')
@Index(['email', 'createdAt'])
export class OtpCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  /** Plain 6-digit login code (short TTL). Not hashed — visible in DB for dev/support. */
  @Column()
  code: string;

  /** Omit explicit DB type so TypeORM picks a valid one per driver (Postgres vs SQLite e2e). */
  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
