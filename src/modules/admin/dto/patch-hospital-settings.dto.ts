import { IsOptional, IsObject } from 'class-validator';

export class PatchHospitalSettingsDto {
  @IsOptional() @IsObject()
  general?: Record<string, unknown>;

  @IsOptional() @IsObject()
  branding?: Record<string, unknown>;

  @IsOptional() @IsObject()
  notifications?: Record<string, unknown>;

  @IsOptional() @IsObject()
  security?: Record<string, unknown>;
}
