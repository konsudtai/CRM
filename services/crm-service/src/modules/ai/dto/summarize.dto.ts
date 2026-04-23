import { IsString, IsIn, IsNotEmpty } from 'class-validator';

export class SummarizeDto {
  @IsString()
  @IsNotEmpty()
  meetingNotes!: string;

  @IsIn(['th', 'en'])
  language!: 'th' | 'en';
}
