import { IsString, IsUUID, IsNumber, IsDateString, IsOptional } from 'class-validator';

export class CreateOpportunityDto {
  @IsString()
  dealName!: string;

  @IsUUID()
  accountId!: string;

  @IsUUID()
  @IsOptional()
  contactId?: string;

  @IsNumber()
  estimatedValue!: number;

  @IsUUID()
  stageId!: string;

  @IsDateString()
  expectedCloseDate!: string;

  @IsUUID()
  assignedTo!: string;
}
