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
import { CreateLineItemDto } from './create-quotation.dto';

export class UpdateQuotationDto {
  @IsOptional()
  @IsUUID()
  accountId?: string;

  @IsOptional()
  @IsUUID()
  contactId?: string;

  @IsOptional()
  @IsUUID()
  opportunityId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateLineItemDto)
  lineItems?: CreateLineItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalDiscount?: number;

  @IsOptional()
  @IsDateString()
  validUntil?: string;
}
