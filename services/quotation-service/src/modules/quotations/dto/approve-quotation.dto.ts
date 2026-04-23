import { IsOptional, IsString } from 'class-validator';

export class ApproveQuotationDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
