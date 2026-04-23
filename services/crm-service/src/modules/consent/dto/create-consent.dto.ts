import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class CreateConsentDto {
  @IsUUID()
  @IsNotEmpty()
  contactId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  purpose!: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
