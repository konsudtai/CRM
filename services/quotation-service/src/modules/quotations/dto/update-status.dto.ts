import { IsString, IsIn } from 'class-validator';

export class UpdateStatusDto {
  @IsString()
  @IsIn(['draft', 'pending_approval', 'sent', 'accepted', 'rejected', 'expired'])
  status!: string;
}
