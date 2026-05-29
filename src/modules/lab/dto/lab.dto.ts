import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsBoolean,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LabOrderPriority } from '../entities/lab-order.entity';

class TestItemDto {
  @IsString() testName: string;
  @IsString() testCode: string;
  @IsNumber() price: number;
}

export class CreateLabOrderDto {
  @IsUUID() patientId: string;
  @IsOptional() @IsUUID() doctorId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestItemDto)
  tests?: TestItemDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  testCatalogIds?: string[];

  @IsOptional() @IsEnum(LabOrderPriority) priority?: LabOrderPriority;
  @IsOptional() @IsString() sampleType?: string;
  @IsOptional() @IsString() notes?: string;
}

export class RecordSampleDto {
  @IsOptional() @IsString() @MinLength(1) sampleBarcode?: string;
}

export class LabResultLineDto {
  @IsString() testName: string;
  @IsString() value: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() normalRange?: string;
  @IsOptional() @IsString() flag?: string;
}

export class UploadLabResultsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LabResultLineDto)
  results: LabResultLineDto[];
}

export class CreateLabTestDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsNumber() price: number;
  @IsOptional() @IsString() sampleTypeHint?: string;
  @IsOptional() @IsString() department?: string;
}

export class UpdateLabTestDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() sampleTypeHint?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
