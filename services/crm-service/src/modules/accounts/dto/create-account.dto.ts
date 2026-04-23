import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  companyName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  industry?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  taxId?: string;

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
  @MaxLength(512)
  website?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  street?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  subDistrict?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  district?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  province?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  postalCode?: string;

  @IsObject()
  @IsOptional()
  customFields?: Record<string, unknown>;
}
