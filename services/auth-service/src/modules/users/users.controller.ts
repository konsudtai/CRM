import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@Controller('users')
@UseGuards(TenantGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'List all users in the tenant' })
  async listUsers(@Req() req: Request, @Query('search') search?: string) {
    const user = (req as any).user;
    return this.usersService.listUsers(user.tenantId, search);
  }

  @Get(':id')
  @RequirePermission('users', 'read')
  @ApiOperation({ summary: 'Get user by ID' })
  async getUser(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.usersService.getUser(user.tenantId, id);
  }

  @Post()
  @RequirePermission('users', 'create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiResponse({ status: 201, description: 'User created' })
  async createUser(@Req() req: Request, @Body() dto: CreateUserDto) {
    const user = (req as any).user;
    return this.usersService.createUser(user.tenantId, dto);
  }

  @Put(':id')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Update user details' })
  async updateUser(@Req() req: Request, @Param('id') id: string, @Body() dto: Partial<CreateUserDto>) {
    const user = (req as any).user;
    return this.usersService.updateUser(user.tenantId, id, dto);
  }

  @Put(':id/roles')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Assign roles to a user' })
  @ApiResponse({ status: 200, description: 'Roles assigned' })
  async assignRoles(@Req() req: Request, @Param('id') id: string, @Body() dto: AssignRolesDto) {
    const user = (req as any).user;
    return this.usersService.assignRoles(user.tenantId, id, dto.roleIds);
  }

  @Put(':id/deactivate')
  @RequirePermission('users', 'delete')
  @ApiOperation({ summary: 'Deactivate a user' })
  async deactivateUser(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.usersService.deactivateUser(user.tenantId, id);
  }

  @Put(':id/activate')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Reactivate a user' })
  async activateUser(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.usersService.activateUser(user.tenantId, id);
  }

  @Put(':id/reset-password')
  @RequirePermission('users', 'update')
  @ApiOperation({ summary: 'Reset user password (admin only)' })
  async resetPassword(@Req() req: Request, @Param('id') id: string, @Body() dto: { newPassword: string }) {
    const user = (req as any).user;
    return this.usersService.resetPassword(user.tenantId, id, dto.newPassword);
  }
}
