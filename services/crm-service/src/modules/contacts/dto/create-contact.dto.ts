import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  IsObject,
  MaxLength,
} from 'class-validator';

export class CreateContactDto {
  @IsUUID()
  @IsNotEmpty()
  accountId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  lastName!: string;

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
