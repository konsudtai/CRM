import { IsUUID, IsString, IsNumber, IsOptional, IsIn } from 'class-validator';

export class CreateTargetDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsIn(['monthly', 'quarterly'])
  period!: 'monthly' | 'quarterly';

  @IsNumber()
  year!: number;

  @IsNumber()
  @IsOptional()
  month?: number;

  @IsNumber()
  @IsOptional()
  quarter?: number;

  @IsNumber()
  targetAmount!: number;
}
