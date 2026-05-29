import {
  IsOptional,
  IsString,
  MaxLength,
  IsNumber,
  Min,
  IsDateString,
  IsUUID,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

const CREDENTIALING = ['none', 'pending_review', 'approved', 'suspended'] as const;

export class UpsertDoctorProfileDto {
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
  @MaxLength(64)
  employeeId?: string;

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
  @IsIn([...CREDENTIALING])
  credentialingStatus?: (typeof CREDENTIALING)[number];

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  credentialingNotes?: string;
}
