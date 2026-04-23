import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PermissionDto } from './create-role.dto';

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  @ArrayMinSize(1)
  @IsOptional()
  permissions?: PermissionDto[];
}
