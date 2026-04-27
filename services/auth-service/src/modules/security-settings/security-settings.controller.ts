import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { SecuritySettingsService } from './security-settings.service';
import { AddIpAllowlistDto } from './dto/add-ip-allowlist.dto';
import { UpdateMfaSettingDto } from './dto/update-mfa-setting.dto';

@ApiTags('Security Settings')
@ApiBearerAuth('bearer')
@Controller('settings/security')
@UseGuards(TenantGuard, PermissionGuard)
export class SecuritySettingsController {
  constructor(private readonly service: SecuritySettingsService) {}

  @Get()
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'Get tenant security settings (MFA, IP allowlist)' })
  @ApiResponse({ status: 200, description: 'Security settings returned' })
  async getSecuritySettings(@Req() req: Request) {
    const user = (req as any).user;
    return this.service.getSecuritySettings(user.tenantId);
  }

  @Put('mfa')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Toggle MFA requirement for the tenant' })
  @ApiResponse({ status: 200, description: 'MFA setting updated' })
  async updateMfaSetting(@Req() req: Request, @Body() dto: UpdateMfaSettingDto) {
    const user = (req as any).user;
    return this.service.updateMfaSetting(user.tenantId, dto.mfaRequired);
  }

  @Put('ip-allowlist/toggle')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Enable or disable IP allowlisting for the tenant' })
  @ApiResponse({ status: 200, description: 'IP allowlist toggled' })
  async toggleIpAllowlist(
    @Req() req: Request,
    @Body() body: { enabled: boolean },
  ) {
    const user = (req as any).user;
    return this.service.toggleIpAllowlist(user.tenantId, body.enabled);
  }

  @Post('ip-allowlist')
  @RequirePermission('users', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add an IP address or CIDR range to the allowlist' })
  @ApiResponse({ status: 201, description: 'IP allowlist entry created' })
  async addIpAllowlistEntry(
    @Req() req: Request,
    @Body() dto: AddIpAllowlistDto,
  ) {
    const user = (req as any).user;
    return this.service.addIpAllowlistEntry(user.tenantId, dto);
  }

  @Delete('ip-allowlist/:id')
  @RequirePermission('users', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an IP address from the allowlist' })
  @ApiResponse({ status: 204, description: 'IP allowlist entry removed' })
  async removeIpAllowlistEntry(
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const user = (req as any).user;
    await this.service.removeIpAllowlistEntry(user.tenantId, id);
  }
}
