import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { MedicineCategory } from '../entities/medicine.entity';
import { FulfillmentStatus } from '../entities/prescription-fulfillment.entity';

export class CreateMedicineDto {
  @IsString() name: string;
  @IsOptional() @IsString() genericName?: string;
  @IsOptional() @IsString() manufacturer?: string;
  @IsEnum(MedicineCategory) category: MedicineCategory;
  @IsString() unit: string;
  @IsNumber() price: number;
  @IsNumber() stock: number;
  @IsOptional() @IsNumber() reorderLevel?: number;
  @IsOptional() @IsString() batchNumber?: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsString() location?: string;
}

export class AdjustStockDto {
  @IsNumber() quantity: number;
  @IsEnum(['add', 'remove']) type: 'add' | 'remove';
}

export class CreateFulfillmentDto {
  @IsUUID() patientId: string;
  @IsOptional() @IsUUID() prescribedById?: string;
  @IsOptional() @IsUUID() sourceEmrRecordId?: string;
  @IsOptional() @IsUUID() medicineId?: string;
  @IsOptional() @IsString() @MaxLength(200) medicineName?: string;
  @IsNumber() quantity: number;
  @IsOptional() @IsString() @MaxLength(120) dose?: string;
  @IsOptional() @IsString() @MaxLength(1200) instructions?: string;
  @IsOptional() @IsString() @MaxLength(1200) notes?: string;
}

export class FulfillmentStatusDto {
  @IsEnum(FulfillmentStatus) status: FulfillmentStatus;
  @IsOptional() @IsString() @MaxLength(1200) notes?: string;
}
