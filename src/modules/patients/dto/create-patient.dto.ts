import { IsNotEmpty, IsEnum, IsOptional, IsEmail, IsDateString, IsMobilePhone, IsUUID } from 'class-validator';
import { Gender, BloodGroup } from '../entities/patient.entity';

export class CreatePatientDto {
  @IsNotEmpty() name: string;
  @IsDateString() dob: string;
  @IsEnum(Gender) gender: Gender;
  @IsEnum(BloodGroup) @IsOptional() bloodGroup?: BloodGroup;
  @IsMobilePhone('en-IN') phone: string;
  @IsEmail() @IsOptional() email?: string;
  @IsUUID() @IsOptional() userId?: string;
  @IsOptional() address?: string;
  @IsOptional() emergencyName?: string;
  @IsOptional() emergencyPhone?: string;
  @IsOptional() emergencyRelation?: string;
  @IsOptional() allergies?: string;
  @IsOptional() notes?: string;
}
