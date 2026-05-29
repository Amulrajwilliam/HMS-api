import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { Role } from '../../../common/enums/roles.enum';
import { DoctorProfile } from '../../staff/entities/doctor-profile.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  /** `simple-enum` maps to varchar/text and works with SQLite (e2e) and Postgres. */
  @Column({ type: 'simple-enum', enum: Role, default: Role.RECEPTIONIST })
  role: Role;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ nullable: true })
  lastLogin: Date;

  /** Public URL path to avatar image (served under /auth/avatars/:fileName). */
  /** Explicit DB type: `string | null` unions confuse TypeORM reflect-metadata → "Object". */
  @Column({ type: 'varchar', length: 2048, nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  preferredLocale: string | null;

  /** light | dark | system */
  @Column({ type: 'varchar', length: 16, nullable: true })
  preferredTheme: string | null;

  /** Base32 TOTP secret; never selected by default queries. */
  @Column({ type: 'varchar', length: 128, nullable: true, select: false })
  totpSecret: string | null;

  @Column({ default: false })
  totpEnabled: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => DoctorProfile, (dp) => dp.user)
  doctorProfile?: DoctorProfile;
}
