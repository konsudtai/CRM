import { IsArray, ValidateNested, IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class StageDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  name!: string;

  @IsNumber()
  sortOrder!: number;

  @IsNumber()
  probability!: number;

  @IsString()
  @IsOptional()
  color?: string;
}

export class UpdateStagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StageDto)
  stages!: StageDto[];
}
