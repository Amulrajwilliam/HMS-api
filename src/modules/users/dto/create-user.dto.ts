import { IsEmail, IsNotEmpty, MinLength, IsEnum, IsOptional } from 'class-validator';
import { Role } from '../../../common/enums/roles.enum';

export class CreateUserDto {
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @MinLength(1)
  password: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}
