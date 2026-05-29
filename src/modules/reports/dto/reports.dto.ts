import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MedicalReportType } from '../entities/medical-report.entity';

export class CreateReportUploadFieldsDto {
  @IsString()
  @MaxLength(500)
  title: string;

  @IsEnum(MedicalReportType)
  reportType: MedicalReportType;

  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : value))
  @IsUUID()
  patientId?: string;
}
