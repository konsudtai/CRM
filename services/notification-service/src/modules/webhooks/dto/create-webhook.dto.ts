import { IsString, IsNotEmpty, IsUrl, IsArray, IsOptional } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl()
  @IsNotEmpty()
  url!: string;

  @IsString()
  @IsNotEmpty()
  secret!: string;

  @IsArray()
  @IsString({ each: true })
  eventTypes!: string[];

  @IsArray()
  @IsString({ each: true })
  entityTypes!: string[];
}
