import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { InsuranceClaimStatus } from '../entities/insurance-claim.entity';

export class CreateInsuranceClaimDto {
  @IsUUID()
  invoiceId: string;

  @IsString()
  @MaxLength(200)
  providerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  policyNumber?: string;

  @IsNumber()
  @Min(0)
  claimAmount: number;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  notes?: string;
}

export class UpdateInsuranceClaimStatusDto {
  @IsEnum(InsuranceClaimStatus)
  status: InsuranceClaimStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  externalClaimId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1200)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  denialReason?: string;
}

export class CheckEligibilityDto {
  @IsUUID()
  patientId: string;

  @IsString()
  @MaxLength(200)
  providerName: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  policyNumber?: string;
}

export class AppealInsuranceClaimDto {
  @IsString()
  @MaxLength(1200)
  appealNotes: string;
}
