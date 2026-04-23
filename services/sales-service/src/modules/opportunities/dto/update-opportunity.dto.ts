import { IsString, IsUUID, IsNumber, IsDateString, IsOptional } from 'class-validator';

export class UpdateOpportunityDto {
  @IsString()
  @IsOptional()
  dealName?: string;

  @IsUUID()
  @IsOptional()
  accountId?: string;

  @IsUUID()
  @IsOptional()
  contactId?: string;

  @IsNumber()
  @IsOptional()
  estimatedValue?: number;

  @IsDateString()
  @IsOptional()
  expectedCloseDate?: string;

  @IsUUID()
  @IsOptional()
  assignedTo?: string;
}
