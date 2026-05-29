import { IsNotEmpty, IsEnum, IsOptional, IsUUID, IsDateString, IsString, MaxLength } from 'class-validator';
import { AppointmentType } from '../entities/appointment.entity';

export class CreateAppointmentDto {
  @IsUUID() patientId: string;
  @IsUUID() doctorId: string;
  @IsDateString() date: string;
  @IsNotEmpty() time: string;
  @IsEnum(AppointmentType) @IsOptional() type?: AppointmentType;
  @IsOptional() department?: string;
  @IsOptional() notes?: string;
  @IsOptional() @IsString() @MaxLength(512) televisitUrl?: string;
  @IsOptional() @MaxLength(4000) televisitInstructions?: string;
}

export class RescheduleAppointmentDto {
  @IsDateString() date: string;
  @IsNotEmpty() time: string;
  @IsOptional() reason?: string;
}
