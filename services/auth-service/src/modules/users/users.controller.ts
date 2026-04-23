import {
  Controller,
  Post,
  Put,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';

@Controller('users')
@UseGuards(TenantGuard, PermissionGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermission('users', 'create')
  @HttpCode(HttpStatus.CREATED)
  async createUser(@Req() req: Request, @Body() dto: CreateUserDto) {
    const user = (req as any).user;
    return this.usersService.createUser(user.tenantId, dto);
  }

  @Put(':id/roles')
  @RequirePermission('users', 'update')
  async assignRoles(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: AssignRolesDto,
  ) {
    const user = (req as any).user;
    return this.usersService.assignRoles(user.tenantId, id, dto.roleIds);
  }
}
