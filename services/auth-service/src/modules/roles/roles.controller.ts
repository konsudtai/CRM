import {
  Controller,
  Post,
  Put,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('Roles')
@ApiBearerAuth('bearer')
@Controller('roles')
@UseGuards(TenantGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @RequirePermission('users', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a custom role with granular permissions' })
  @ApiResponse({ status: 201, description: 'Role created' })
  async createRole(@Req() req: Request, @Body() dto: CreateRoleDto) {
    const user = (req as any).user;
    return this.rolesService.createRole(user.tenantId, dto);
  }

  @Put(':id')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Update role permissions' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  async updateRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const user = (req as any).user;
    return this.rolesService.updateRole(user.tenantId, id, dto);
  }

  @Get()
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'List all roles for the tenant' })
  @ApiResponse({ status: 200, description: 'List of roles with permissions' })
  async listRoles(@Req() req: Request) {
    const user = (req as any).user;
    return this.rolesService.listRoles(user.tenantId);
  }
}
