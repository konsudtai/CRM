import {
  Controller,
  Get,
  Post,
  Put,
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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller()
@UseGuards(TenantGuard, PermissionGuard)
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get('accounts/:accountId/contacts')
  @RequirePermission('contacts', 'read')
  async findByAccount(
    @Req() req: Request,
    @Param('accountId') accountId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const user = (req as any).user;
    return this.contactsService.findByAccount(user.tenantId, accountId, page, limit);
  }

  @Post('contacts')
  @RequirePermission('contacts', 'create')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: Request, @Body() dto: CreateContactDto) {
    const user = (req as any).user;
    return this.contactsService.create(user.tenantId, dto);
  }

  @Put('contacts/:id')
  @RequirePermission('contacts', 'update')
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    const user = (req as any).user;
    return this.contactsService.update(user.tenantId, id, dto);
  }
}
