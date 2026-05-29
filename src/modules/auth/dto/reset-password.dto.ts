import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  otpCode: string;

  @IsString()
  @MinLength(1)
  newPassword: string;
}
