import { IsString, IsOptional, IsEmail, MaxLength, IsBoolean, IsArray, IsUUID } from 'class-validator';

export class CreateLeadDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  lineId?: string;

  @IsString()
  @MaxLength(100)
  source!: string;

  @IsOptional()
  @IsBoolean()
  autoAssign?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  activeRepIds?: string[];
}
