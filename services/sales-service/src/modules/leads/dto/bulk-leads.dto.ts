import { IsArray, IsEnum, IsString, IsUUID } from 'class-validator';

export enum BulkAction {
  ASSIGN = 'assign',
  STATUS = 'status',
  DELETE = 'delete',
}

export class BulkLeadsDto {
  @IsEnum(BulkAction)
  action!: BulkAction;

  @IsArray()
  @IsUUID('4', { each: true })
  leadIds!: string[];

  @IsString()
  value!: string;
}
