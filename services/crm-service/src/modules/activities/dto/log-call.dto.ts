import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsUUID,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export type CallOutcome = 'Connected' | 'No Answer' | 'Left Voicemail' | 'Busy';

export class LogCallDto {
  @IsInt()
  @Min(0)
  duration!: number; // minutes

  @IsIn(['Connected', 'No Answer', 'Left Voicemail', 'Busy'])
  @IsNotEmpty()
  outcome!: CallOutcome;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  notes?: string;

  @IsUUID()
  @IsOptional()
  accountId?: string;

  @IsUUID()
  @IsOptional()
  contactId?: string;
}
