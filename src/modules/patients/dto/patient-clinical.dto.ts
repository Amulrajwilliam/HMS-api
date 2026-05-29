import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ProblemStatus } from '../entities/patient-problem.entity';
import { AllergySource, AllergyStatus } from '../entities/patient-allergy.entity';

export class CreatePatientProblemDto {
  @IsOptional() @IsString() @MaxLength(32) icdCode?: string;
  @IsString() @MinLength(1) @MaxLength(2000) description: string;
  @IsOptional() @IsString() onsetDate?: string;
}

export class UpdatePatientProblemDto {
  @IsOptional() @IsString() @MaxLength(32) icdCode?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(2000) description?: string;
  @IsOptional() @IsEnum(ProblemStatus) status?: ProblemStatus;
  @IsOptional() @IsString() onsetDate?: string;
}

export class CreatePatientAllergyDto {
  @IsString() @MinLength(1) @MaxLength(256) substance: string;
  @IsOptional() @IsString() @MaxLength(2000) reaction?: string;
  @IsOptional() @IsString() @MaxLength(32) severity?: string;
  @IsOptional() @IsEnum(AllergyStatus) status?: AllergyStatus;
  @IsOptional() @IsEnum(AllergySource) source?: AllergySource;
}

export class UpdatePatientAllergyDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(256) substance?: string;
  @IsOptional() @IsString() reaction?: string;
  @IsOptional() @IsString() @MaxLength(32) severity?: string;
  @IsOptional() @IsEnum(AllergyStatus) status?: AllergyStatus;
}

export class ReconcileAllergiesDto {
  @IsOptional() @IsUUID('4', { each: true }) allergyIds?: string[];
}
