import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class SubmitExternalLabOrderDto {
  @IsUUID() orderId: string;
  @IsOptional() @IsString() @MaxLength(120) provider?: string;
}

export class SubmitExternalInsuranceClaimDto {
  @IsUUID() claimId: string;
  @IsOptional() @IsString() @MaxLength(120) provider?: string;
}

export class LookupPacsStudyDto {
  @IsString() @MaxLength(120) studyUid: string;
  @IsOptional() @IsString() @MaxLength(120) patientMrn?: string;
}
