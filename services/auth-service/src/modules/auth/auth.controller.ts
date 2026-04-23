import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RefreshDto } from './dto/refresh.dto';
import { TenantGuard } from '../../guards/tenant.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/login ──────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // ── POST /auth/mfa/verify ─────────────────────────────────────────────

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@Body() dto: MfaVerifyDto) {
    return this.authService.verifyMfa(dto.mfaToken, dto.code);
  }

  // ── POST /auth/sso/:provider ──────────────────────────────────────────

  @Post('sso/:provider')
  @HttpCode(HttpStatus.OK)
  async ssoInitiate(@Param('provider') provider: string) {
    // TODO: Implement Passport.js Google Workspace strategy
    // TODO: Implement Passport.js Microsoft Entra ID strategy
    return {
      message: `SSO initiation for ${provider} — not yet implemented`,
      provider,
      status: 'pending_implementation',
    };
  }

  // ── POST /auth/sso/:provider/callback ─────────────────────────────────

  @Post('sso/:provider/callback')
  @HttpCode(HttpStatus.OK)
  async ssoCallback(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
  ) {
    // TODO: Implement Passport.js callback handler for Google Workspace
    // TODO: Implement Passport.js callback handler for Microsoft Entra ID
    return {
      message: `SSO callback for ${provider} — not yet implemented`,
      provider,
      status: 'pending_implementation',
    };
  }

  // ── POST /auth/logout ─────────────────────────────────────────────────

  @Post('logout')
  @UseGuards(TenantGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    const token = this.extractToken(req);
    if (token) {
      await this.authService.logout(token);
    }
    return { message: 'Logged out successfully' };
  }

  // ── POST /auth/refresh ────────────────────────────────────────────────

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // ── GET /auth/me ──────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(TenantGuard)
  async getMe(@Req() req: Request) {
    const user = (req as any).user;
    return this.authService.getMe(user.sub);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private extractToken(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (!authHeader) return undefined;
    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }
}
