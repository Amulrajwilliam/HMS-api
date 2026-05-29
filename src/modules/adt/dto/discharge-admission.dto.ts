import { IsString, MinLength } from 'class-validator';

export class DischargeAdmissionDto {
  @IsString()
  @MinLength(4, { message: 'Discharge summary must be at least 4 characters' })
  summary: string;
}
