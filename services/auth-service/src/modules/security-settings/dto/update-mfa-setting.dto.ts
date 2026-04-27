import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMfaSettingDto {
  @ApiProperty({ description: 'Whether MFA is required for all users in this tenant' })
  @IsBoolean()
  mfaRequired!: boolean;
}
