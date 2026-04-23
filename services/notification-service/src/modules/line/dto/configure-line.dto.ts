import { IsNotEmpty, IsString } from 'class-validator';

export class ConfigureLineDto {
  @IsString()
  @IsNotEmpty()
  channelAccessToken!: string;

  @IsString()
  @IsNotEmpty()
  channelSecret!: string;
}
