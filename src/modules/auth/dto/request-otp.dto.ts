import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  @IsEmail()
  email: string;

  /** E.164, e.g. +15551234567 — used when Twilio env is configured. */
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{10,15}$/, { message: 'phone must be E.164 (+countrycode...)' })
  phone?: string;
}
