import { IsUUID, IsOptional, IsString, IsNumber } from 'class-validator';

/** Vitals-only EMR entry (outpatient or inpatient). */
export class RecordVitalsDto {
  @IsUUID() patientId: string;

  @IsOptional() @IsString() bloodPressure?: string;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsNumber() weight?: number;
  @IsOptional() @IsNumber() height?: number;
  @IsOptional() @IsString() pulseRate?: string;
  @IsOptional() @IsString() oxygenSaturation?: string;
  @IsOptional() @IsString() respiratoryRate?: string;
}

/** @deprecated Use RecordVitalsDto — kept for imports. */
export { RecordVitalsDto as NurseVitalsDto };
