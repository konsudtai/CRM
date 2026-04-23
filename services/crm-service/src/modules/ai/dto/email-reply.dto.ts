import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class EmailReplyDto {
  @IsString()
  @IsNotEmpty()
  emailThread!: string;

  @IsString()
  @IsOptional()
  customerHistory?: string;

  @IsIn(['th', 'en'])
  @IsOptional()
  language?: 'th' | 'en';
}
