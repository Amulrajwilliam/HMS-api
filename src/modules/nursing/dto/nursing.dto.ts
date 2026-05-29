import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { CarePlanStatus, EmarStatus } from '../entities/nursing-chart.entity';

export class CreateFlowsheetDto {
  @IsOptional() @IsString() @MaxLength(32) shiftLabel?: string;
  @IsOptional() @IsString() @MaxLength(32) bloodPressure?: string;
  @IsOptional() @IsNumber() temperature?: number;
  @IsOptional() @IsString() @MaxLength(16) pulseRate?: string;
  @IsOptional() @IsString() @MaxLength(16) respiratoryRate?: string;
  @IsOptional() @IsString() @MaxLength(16) oxygenSaturation?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10) painScore?: number;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class CreateCarePlanDto {
  @IsString() @MaxLength(2000) problem: string;
  @IsOptional() @IsString() @MaxLength(2000) goal?: string;
  @IsOptional() @IsString() @MaxLength(2000) intervention?: string;
}

export class UpdateCarePlanDto {
  @IsOptional() @IsString() @MaxLength(2000) goal?: string;
  @IsOptional() @IsString() @MaxLength(2000) intervention?: string;
  @IsOptional() @IsEnum(CarePlanStatus) status?: CarePlanStatus;
}

export class RecordEwsDto {
  @IsInt() @Min(0) respiratoryRate: number;
  @IsInt() @Min(0) @Max(100) spo2: number;
  @IsBoolean() supplementalO2: boolean;
  @IsNumber() temperature: number;
  @IsInt() @Min(0) systolicBp: number;
  @IsInt() @Min(0) pulse: number;
  @IsString() @MaxLength(8) consciousness: string;
}

export class CreateEmarDto {
  @IsString() @MaxLength(256) medicineName: string;
  @IsOptional() @IsString() @MaxLength(128) dose?: string;
  @IsOptional() @IsString() @MaxLength(64) route?: string;
  @IsOptional() @IsString() scheduledAt?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class UpdateEmarDto {
  @IsEnum(EmarStatus) status: EmarStatus;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
