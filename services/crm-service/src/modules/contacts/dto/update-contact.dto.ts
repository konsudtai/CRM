import {
  IsString,
  IsOptional,
  IsEmail,
  IsObject,
  MaxLength,
} from 'class-validator';

export class UpdateContactDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  firstName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  lastName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  lineId?: string;

  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}
