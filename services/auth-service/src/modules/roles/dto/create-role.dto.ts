import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PermissionDto {
  @IsString()
  @IsNotEmpty()
  module!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(['create', 'read', 'update', 'delete'], { each: true })
  actions!: ('create' | 'read' | 'update' | 'delete')[];
}

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  @ArrayMinSize(1)
  permissions!: PermissionDto[];
}
