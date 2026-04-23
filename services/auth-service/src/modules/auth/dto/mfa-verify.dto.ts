import { IsNotEmpty, IsString } from 'class-validator';

export class MfaVerifyDto {
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}
