import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class SyncEventDto {
  @IsUUID()
  eventId: string;

  @IsString()
  @MaxLength(80)
  module: string;

  @IsString()
  @MaxLength(80)
  action: string;

  @IsObject()
  payload: Record<string, unknown>;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

export class SyncQueueDto {
  @IsString()
  @MaxLength(120)
  deviceId: string;

  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SyncEventDto)
  events: SyncEventDto[];
}
