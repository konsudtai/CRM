import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantGuard } from '../../guards/tenant.guard';
import { PermissionGuard } from '../../guards/permission.guard';
import { RequirePermission } from '../../decorators/require-permission.decorator';
import { GmailService } from './gmail.service';
import { OutlookService } from './outlook.service';
import { EmailSyncService } from './email-sync.service';
import { ConnectEmailDto, EmailCallbackDto } from './dto/connect-email.dto';

@Controller('email')
@UseGuards(TenantGuard, PermissionGuard)
export class EmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly outlookService: OutlookService,
    private readonly emailSyncService: EmailSyncService,
  ) {}

  /** Initiate Gmail OAuth2 flow — returns the authorization URL */
  @Post('gmail/connect')
  @RequirePermission('contacts', 'read')
  async connectGmail(
    @Req() req: Request,
    @Body() dto: ConnectEmailDto,
  ) {
    const user = (req as any).user;
    const sync = await this.emailSyncService.getOrCreateSync(
      user.tenantId,
      user.sub,
      'gmail',
    );
    const authUrl = this.gmailService.getAuthUrl(dto.redirectUri);
    return { authUrl, syncId: sync.id };
  }

  /** Handle Gmail OAuth2 callback — exchange code for tokens */
  @Post('gmail/callback')
  @RequirePermission('contacts', 'read')
  async gmailCallback(
    @Req() req: Request,
    @Body() dto: EmailCallbackDto,
  ) {
    const user = (req as any).user;
    const sync = await this.emailSyncService.getOrCreateSync(
      user.tenantId,
      user.sub,
      'gmail',
    );
    const tokens = await this.gmailService.exchangeCode(dto.code, dto.redirectUri);
    await this.emailSyncService.storeTokens(
      sync.id,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
    );
    return { success: true, provider: 'gmail', status: 'connected' };
  }

  /** Initiate Outlook OAuth2 flow — returns the authorization URL */
  @Post('outlook/connect')
  @RequirePermission('contacts', 'read')
  async connectOutlook(
    @Req() req: Request,
    @Body() dto: ConnectEmailDto,
  ) {
    const user = (req as any).user;
    const sync = await this.emailSyncService.getOrCreateSync(
      user.tenantId,
      user.sub,
      'outlook',
    );
    const authUrl = this.outlookService.getAuthUrl(dto.redirectUri);
    return { authUrl, syncId: sync.id };
  }

  /** Handle Outlook OAuth2 callback — exchange code for tokens */
  @Post('outlook/callback')
  @RequirePermission('contacts', 'read')
  async outlookCallback(
    @Req() req: Request,
    @Body() dto: EmailCallbackDto,
  ) {
    const user = (req as any).user;
    const sync = await this.emailSyncService.getOrCreateSync(
      user.tenantId,
      user.sub,
      'outlook',
    );
    const tokens = await this.outlookService.exchangeCode(dto.code, dto.redirectUri);
    await this.emailSyncService.storeTokens(
      sync.id,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
    );
    return { success: true, provider: 'outlook', status: 'connected' };
  }

  /** Trigger manual email sync for the current user */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('contacts', 'read')
  async triggerSync(@Req() req: Request) {
    const user = (req as any).user;
    const results = await this.emailSyncService.executeSync(
      user.tenantId,
      user.sub,
    );
    return { results };
  }

  /** Get sync status for the current user */
  @Get('status')
  @RequirePermission('contacts', 'read')
  async getSyncStatus(@Req() req: Request) {
    const user = (req as any).user;
    const syncs = await this.emailSyncService.getSyncStatus(
      user.tenantId,
      user.sub,
    );
    return { syncs };
  }
}
