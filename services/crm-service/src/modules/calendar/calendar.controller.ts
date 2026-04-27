import {
  Controller,
  Post,
  Get,
  Body,
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
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { CalendarSyncService } from './calendar-sync.service';
import { ConnectCalendarDto, CalendarCallbackDto } from './dto/connect-calendar.dto';

@Controller('calendar')
@UseGuards(TenantGuard, PermissionGuard)
export class CalendarController {
  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly microsoftCalendarService: MicrosoftCalendarService,
    private readonly calendarSyncService: CalendarSyncService,
  ) {}

  /** Initiate Google Calendar OAuth2 flow — returns the authorization URL */
  @Post('google/connect')
  @RequirePermission('contacts', 'read')
  async connectGoogle(
    @Req() req: Request,
    @Body() dto: ConnectCalendarDto,
  ) {
    const user = (req as any).user;
    const sync = await this.calendarSyncService.getOrCreateSync(
      user.tenantId,
      user.sub,
      'google_calendar',
    );
    const authUrl = this.googleCalendarService.getAuthUrl(dto.redirectUri);
    return { authUrl, syncId: sync.id };
  }

  /** Handle Google Calendar OAuth2 callback — exchange code for tokens */
  @Post('google/callback')
  @RequirePermission('contacts', 'read')
  async googleCallback(
    @Req() req: Request,
    @Body() dto: CalendarCallbackDto,
  ) {
    const user = (req as any).user;
    const sync = await this.calendarSyncService.getOrCreateSync(
      user.tenantId,
      user.sub,
      'google_calendar',
    );
    const tokens = await this.googleCalendarService.exchangeCode(dto.code, dto.redirectUri);
    await this.calendarSyncService.storeTokens(
      sync.id,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
    );
    return { success: true, provider: 'google_calendar', status: 'connected' };
  }

  /** Initiate Microsoft 365 Calendar OAuth2 flow — returns the authorization URL */
  @Post('microsoft/connect')
  @RequirePermission('contacts', 'read')
  async connectMicrosoft(
    @Req() req: Request,
    @Body() dto: ConnectCalendarDto,
  ) {
    const user = (req as any).user;
    const sync = await this.calendarSyncService.getOrCreateSync(
      user.tenantId,
      user.sub,
      'microsoft_calendar',
    );
    const authUrl = this.microsoftCalendarService.getAuthUrl(dto.redirectUri);
    return { authUrl, syncId: sync.id };
  }

  /** Handle Microsoft 365 Calendar OAuth2 callback — exchange code for tokens */
  @Post('microsoft/callback')
  @RequirePermission('contacts', 'read')
  async microsoftCallback(
    @Req() req: Request,
    @Body() dto: CalendarCallbackDto,
  ) {
    const user = (req as any).user;
    const sync = await this.calendarSyncService.getOrCreateSync(
      user.tenantId,
      user.sub,
      'microsoft_calendar',
    );
    const tokens = await this.microsoftCalendarService.exchangeCode(dto.code, dto.redirectUri);
    await this.calendarSyncService.storeTokens(
      sync.id,
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiresAt,
    );
    return { success: true, provider: 'microsoft_calendar', status: 'connected' };
  }

  /** Trigger manual calendar sync for the current user */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('contacts', 'read')
  async triggerSync(@Req() req: Request) {
    const user = (req as any).user;
    const results = await this.calendarSyncService.executeSync(
      user.tenantId,
      user.sub,
    );
    return { results };
  }

  /** Get calendar events for the current user (used by frontend calendar page) */
  @Get('events')
  @RequirePermission('contacts', 'read')
  async getEvents(
    @Req() req: Request,
    @Query('since') since?: string,
  ) {
    const user = (req as any).user;
    const sinceDate = since ? new Date(since) : undefined;
    const events = await this.calendarSyncService.getCalendarEvents(
      user.tenantId,
      user.sub,
      sinceDate,
    );
    return { events };
  }

  /** Get sync status for the current user */
  @Get('status')
  @RequirePermission('contacts', 'read')
  async getSyncStatus(@Req() req: Request) {
    const user = (req as any).user;
    const syncs = await this.calendarSyncService.getSyncStatus(
      user.tenantId,
      user.sub,
    );
    return { syncs };
  }
}
