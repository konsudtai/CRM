import {
  IsString,
  IsOptional,
  IsIn,
  IsDateString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsIn(['High', 'Medium', 'Low'])
  @IsOptional()
  priority?: 'High' | 'Medium' | 'Low';

  @IsIn(['Open', 'In Progress', 'Completed', 'Overdue'])
  @IsOptional()
  status?: 'Open' | 'In Progress' | 'Completed' | 'Overdue';

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
