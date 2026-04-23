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
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('accounts')
@UseGuards(TenantGuard, PermissionGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  @RequirePermission('accounts', 'read')
  async findAll(
    @Req() req: Request,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    const user = (req as any).user;
    return this.accountsService.findAll(user.tenantId, page, limit, search);
  }

  @Post()
  @RequirePermission('accounts', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateAccountDto) {
    const user = (req as any).user;
    return this.accountsService.create(user.tenantId, user.sub, dto);
  }

  @Get(':id')
  @RequirePermission('accounts', 'read')
  async findOne(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.accountsService.findOne(user.tenantId, id);
  }

  @Put(':id')
  @RequirePermission('accounts', 'update')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
  ) {
    const user = (req as any).user;
    return this.accountsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @RequirePermission('accounts', 'delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    await this.accountsService.softDelete(user.tenantId, id);
  }
}
