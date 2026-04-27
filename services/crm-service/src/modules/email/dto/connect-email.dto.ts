import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectEmailDto {
  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}

export class EmailCallbackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}
