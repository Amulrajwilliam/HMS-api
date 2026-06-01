import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { CheckInQueueStatus } from '../entities/visit-check-in.entity';
import { WaitlistStatus } from '../entities/appointment-waitlist.entity';
import { ReminderCampaignType } from '../entities/reminder-campaign-log.entity';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null || value === undefined ? undefined : value;

export class CheckInDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  appointmentId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  doctorId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  department?: string;
}

export class UpdateQueueStatusDto {
  @IsEnum(CheckInQueueStatus)
  status: CheckInQueueStatus;
}

export class CreateWaitlistDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  doctorId: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsDateString()
  preferredDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateWaitlistDto {
  @IsOptional()
  @IsEnum(WaitlistStatus)
  status?: WaitlistStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RunReminderCampaignDto {
  @IsEnum(ReminderCampaignType)
  campaignType: ReminderCampaignType;
}

export class MergePatientsDto {
  @IsUUID()
  survivorPatientId: string;

  @IsUUID()
  duplicatePatientId: string;
}

export class FindDuplicatesQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number;
}
