import { IsString, IsNotEmpty } from 'class-validator';

export class ConnectCalendarDto {
  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}

export class CalendarCallbackDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  redirectUri!: string;
}
