import { IsString, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
