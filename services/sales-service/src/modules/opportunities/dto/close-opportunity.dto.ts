import { IsString, IsIn, IsOptional } from 'class-validator';

export class CloseOpportunityDto {
  @IsString()
  @IsIn(['Won', 'Lost'])
  outcome!: 'Won' | 'Lost';

  @IsString()
  reason!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
