import { IsString, MaxLength } from 'class-validator';

export class UpdateLeadStatusDto {
  @IsString()
  @MaxLength(50)
  status!: string;
}
