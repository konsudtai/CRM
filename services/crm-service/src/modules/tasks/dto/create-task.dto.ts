import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsNotEmpty()
  dueDate!: string;

  @IsIn(['High', 'Medium', 'Low'])
  @IsNotEmpty()
  priority!: 'High' | 'Medium' | 'Low';

  @IsUUID()
  @IsOptional()
  assignedTo?: string;

  @IsUUID()
  @IsOptional()
  accountId?: string;

  @IsUUID()
  @IsOptional()
  contactId?: string;

  @IsUUID()
  @IsOptional()
  opportunityId?: string;
}
