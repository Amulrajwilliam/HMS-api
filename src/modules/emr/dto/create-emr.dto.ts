import {
  IsOptional, IsUUID, IsString, IsDateString, IsArray, ValidateNested, IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PrescriptionDto {
  @IsString() drug: string;
  @IsString() dosage: string;
  @IsString() frequency: string;
  @IsString() duration: string;
  @IsOptional() @IsString() instructions?: string;
}

export class CreateEmrDto {
  @IsUUID() patientId: string;
  @IsUUID() doctorId: string;
  @IsUUID() @IsOptional() appointmentId?: string;

  // Vitals
  @IsOptional() @IsString() bloodPressure?: string;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsString() pulseRate?: string;
  @IsOptional() @IsString() oxygenSaturation?: string;
  @IsOptional() @IsString() respiratoryRate?: string;

  // Consultation
  @IsOptional() @IsString() chiefComplaint?: string;
  @IsOptional() @IsString() historyOfPresentIllness?: string;
  @IsOptional() @IsString() physicalExamination?: string;
  @IsOptional() @IsString() diagnosis?: string;
  /** Optional ICD-10 codes; merged into `diagnosis` text as `[ICD …]` on save. */
  @IsOptional() @IsArray() @IsString({ each: true })
  icdCodes?: string[];
  @IsOptional() @IsString() differentialDiagnosis?: string;
  @IsOptional() @IsString() treatmentPlan?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() followUpInstructions?: string;
  @IsOptional() @IsDateString() followUpDate?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => PrescriptionDto)
  prescriptions?: PrescriptionDto[];
}
