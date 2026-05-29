import { IsNotEmpty } from 'class-validator';

export class DeleteAccountDto {
  @IsNotEmpty()
  password: string;
}
