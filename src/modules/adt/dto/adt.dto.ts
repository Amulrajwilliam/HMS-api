import { IsString, IsEnum, IsNumber, IsOptional, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { WardType } from '../entities/ward.entity';

export class CreateWardDto {
  @IsString() name: string;
  @IsEnum(WardType) type: WardType;
  @IsString() floor: string;
  @IsOptional() @IsString() description?: string;
}

export class CreateBedDto {
  @IsUUID() wardId: string;
  @IsString() bedNumber: string;
  @IsNumber() pricePerDay: number;
  @IsOptional() @IsString() bedType?: string;
}

export class AdmitPatientDto {
  @IsUUID() patientId: string;
  @IsUUID() bedId: string;
  @IsOptional() @IsUUID() doctorId?: string;
  @IsOptional() @IsString() diagnosis?: string;
  @IsOptional() @IsString() notes?: string;
}
