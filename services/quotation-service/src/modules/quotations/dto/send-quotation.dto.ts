import { IsIn, IsString, IsNotEmpty } from 'class-validator';

export class SendQuotationDto {
  @IsIn(['email', 'line'])
  channel!: 'email' | 'line';

  @IsString()
  @IsNotEmpty()
  recipient!: string;
}
