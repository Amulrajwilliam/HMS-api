import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class TwoFactorVerifyLoginDto {
  @IsString()
  @IsNotEmpty()
  twoFactorToken!: string;

  @IsString()
  @Length(6, 8)
  code!: string;
}

export class TwoFactorEnableDto {
  @IsOptional()
  @IsString()
  secret?: string;

  @IsString()
  @Length(6, 8)
  code!: string;
}

export class TwoFactorDisableDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}
