import {
  IsString,
  IsUUID,
  IsOptional,
  IsArray,
  IsNumber,
  IsEnum,
  IsDateString,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLineItemDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @IsEnum(['percentage', 'fixed'])
  discountType?: 'percentage' | 'fixed';
}

export class CreateQuotationDto {
  @IsUUID()
  accountId!: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateLineItemDto)
  lineItems!: CreateLineItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDiscount?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
