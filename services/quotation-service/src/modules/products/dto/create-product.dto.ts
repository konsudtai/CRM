import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsString()
  @MaxLength(100)
  sku!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsString()
  @MaxLength(50)
  unitOfMeasure!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  whtRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
