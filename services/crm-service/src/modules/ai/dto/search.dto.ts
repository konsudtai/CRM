import { IsString, IsNotEmpty } from 'class-validator';

export class NlSearchDto {
  @IsString()
  @IsNotEmpty()
  query!: string;
}
