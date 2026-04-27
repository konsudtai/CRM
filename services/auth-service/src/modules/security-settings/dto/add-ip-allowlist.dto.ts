import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddIpAllowlistDto {
  @ApiProperty({
    description: 'IPv4 address or CIDR notation (e.g. "192.168.1.1" or "10.0.0.0/24")',
    example: '192.168.1.0/24',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/,
    { message: 'address must be a valid IPv4 address or CIDR (e.g. 192.168.1.0/24)' },
  )
  address!: string;

  @ApiPropertyOptional({ description: 'Optional description for this entry' })
  @IsString()
  @IsOptional()
  description?: string;
}
