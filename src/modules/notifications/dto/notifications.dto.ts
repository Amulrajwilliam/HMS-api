import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { NotificationModule, NotificationType } from '../entities/notification.entity';

export class UpsertNotificationTemplateDto {
  @IsString()
  @MaxLength(120)
  key: string;

  @IsString()
  @MaxLength(200)
  titleTemplate: string;

  @IsString()
  @MaxLength(2000)
  messageTemplate: string;

  @IsOptional()
  @IsEnum(NotificationType)
  defaultType?: NotificationType;

  @IsOptional()
  @IsEnum(NotificationModule)
  defaultModule?: NotificationModule;
}

export class DispatchNotificationDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  templateKey?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @IsOptional()
  @IsEnum(NotificationModule)
  module?: NotificationModule;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  actionUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  relatedId?: string;

  @IsOptional()
  @IsBoolean()
  sendInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  sendEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  sendSms?: boolean;

  @IsOptional()
  @IsBoolean()
  sendPush?: boolean;

  @IsOptional()
  @IsEmail()
  emailTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  smsTo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  pushTokens?: string[];
}

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(512)
  pushToken: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  platform?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  provider?: 'expo' | 'fcm' | 'apns';
}

export class CreateNotificationTemplateBodyDto {
  @ValidateNested()
  @Type(() => UpsertNotificationTemplateDto)
  template: UpsertNotificationTemplateDto;
}
