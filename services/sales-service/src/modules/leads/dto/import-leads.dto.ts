import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IsString, IsOptional, IsEmail, MaxLength } from 'class-validator';

export class ImportLeadRowDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

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

  @IsOptional()
  @IsString()
  @MaxLength(100)
  source?: string;
}

export class ImportLeadsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportLeadRowDto)
  rows!: ImportLeadRowDto[];
}
