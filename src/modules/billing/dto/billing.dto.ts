import {
  IsUUID,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
  IsEnum,
  IsDateString,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMode } from '../entities/invoice.entity';

export class InvoiceItemDto {
  @IsOptional()
  @IsUUID()
  billableServiceId?: string;

  @ValidateIf((o: InvoiceItemDto) => !o.billableServiceId)
  @IsString()
  description?: string;

  @IsNumber()
  @IsPositive()
  quantity: number;

  @ValidateIf((o: InvoiceItemDto) => !o.billableServiceId)
  @IsNumber()
  @IsPositive()
  unitPrice?: number;
}

export class CreateInvoiceDto {
  @IsUUID() patientId: string;
  @IsUUID() @IsOptional() doctorId?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];
  @IsNumber() @IsOptional() taxRate?: number;
  @IsNumber() @IsOptional() discount?: number;
  @IsDateString() @IsOptional() dueDate?: string;
  @IsOptional() notes?: string;
}

export class CreatePaymentDto {
  @IsUUID() invoiceId: string;
  @IsNumber() @IsPositive() amount: number;
  @IsEnum(PaymentMode) mode: PaymentMode;
  @IsOptional() transactionRef?: string;
  @IsOptional() remarks?: string;
}
