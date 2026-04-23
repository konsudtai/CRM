import { IsString, IsNotEmpty, IsIn, IsOptional, IsObject } from 'class-validator';

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsIn(['line', 'email', 'in_app'])
  channel!: 'line' | 'email' | 'in_app';

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
