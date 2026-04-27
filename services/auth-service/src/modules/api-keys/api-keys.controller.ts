import {
  Controller,
  Post,
  Get,
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
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(TenantGuard, PermissionGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @RequirePermission('settings', 'create')
  @ApiOperation({ summary: 'Create a new API key for the tenant' })
  @ApiResponse({ status: 201, description: 'API key created. The raw key is returned only once.' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient permissions' })
  async create(@Req() req: Request, @Body() dto: CreateApiKeyDto) {
    const user = (req as any).user;
    return this.apiKeysService.create(user.tenantId, user.sub, dto);
  }

  @Get()
  @RequirePermission('settings', 'read')
  @ApiOperation({ summary: 'List all API keys for the tenant' })
  @ApiResponse({ status: 200, description: 'List of API keys (without raw key values)' })
  async findAll(@Req() req: Request) {
    const user = (req as any).user;
    return this.apiKeysService.findAll(user.tenantId);
  }

  @Delete(':id')
  @RequirePermission('settings', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiResponse({ status: 204, description: 'API key revoked' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async revoke(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    await this.apiKeysService.revoke(user.tenantId, id);
  }
}
