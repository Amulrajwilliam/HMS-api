import {
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Fields a doctor may update on their own directory profile (not credentialing status). */
export class PatchDoctorSelfProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  medicalRegistrationNo?: string;

  @IsOptional()
  @IsDateString()
  registrationExpiry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  specialties?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  qualification?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  department?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  consultationFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  languages?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  designation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  clinicalPhone?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  clinicStartTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  clinicEndTime?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(15)
  slotDurationMinutes?: number;

  /** Comma-separated ISO weekdays 1=Mon … 7=Sun */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  workingDays?: string;
}
