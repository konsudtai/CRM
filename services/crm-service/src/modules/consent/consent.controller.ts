import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { ConsentService } from './consent.service';
import { CreateConsentDto } from './dto/create-consent.dto';

@Controller()
@UseGuards(TenantGuard, PermissionGuard)
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post('consent')
  @RequirePermission('consent', 'create')
  @HttpCode(HttpStatus.CREATED)
  async grantConsent(@Req() req: Request, @Body() dto: CreateConsentDto) {
    const user = (req as any).user;
    return this.consentService.grantConsent(user.tenantId, user.sub, dto);
  }

  @Get('consent')
  @RequirePermission('consent', 'read')
  async findByContact(
    @Req() req: Request,
    @Query('contactId') contactId: string,
  ) {
    const user = (req as any).user;
    return this.consentService.findByContact(user.tenantId, contactId);
  }

  @Post('consent/:id/withdraw')
  @RequirePermission('consent', 'create')
  @HttpCode(HttpStatus.CREATED)
  async withdrawConsent(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.consentService.withdrawConsent(user.tenantId, user.sub, id);
  }

  @Delete('contacts/:id/pdpa')
  @RequirePermission('consent', 'delete')
  async requestPdpaDeletion(@Req() req: Request, @Param('id') id: string) {
    const user = (req as any).user;
    return this.consentService.requestPdpaDeletion(user.tenantId, user.sub, id);
  }
}
