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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MfaVerifyDto } from './dto/mfa-verify.dto';
import { RefreshDto } from './dto/refresh.dto';
import { TenantGuard } from '../../guards/tenant.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── POST /auth/login ──────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful — returns JWT access and refresh tokens' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked due to too many failed attempts' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // ── POST /auth/mfa/verify ─────────────────────────────────────────────

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify MFA code after initial login' })
  @ApiResponse({ status: 200, description: 'MFA verified — returns JWT tokens' })
  @ApiResponse({ status: 401, description: 'Invalid or expired MFA token/code' })
  async verifyMfa(@Body() dto: MfaVerifyDto) {
    return this.authService.verifyMfa(dto.mfaToken, dto.code);
  }

  // ── POST /auth/sso/:provider ──────────────────────────────────────────

  @Post('sso/:provider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate SSO flow for a provider (Google Workspace, Microsoft Entra ID)' })
  @ApiResponse({ status: 200, description: 'SSO initiation response' })
  async ssoInitiate(@Param('provider') provider: string) {
    return {
      message: `SSO initiation for ${provider} — not yet implemented`,
      provider,
      status: 'pending_implementation',
    };
  }

  // ── POST /auth/sso/:provider/callback ─────────────────────────────────

  @Post('sso/:provider/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SSO callback handler' })
  @ApiResponse({ status: 200, description: 'SSO callback processed' })
  async ssoCallback(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
  ) {
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
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Logout and invalidate the current session token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiResponse({ status: 200, description: 'New access and refresh tokens issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  // ── GET /auth/me ──────────────────────────────────────────────────────

  @Get('me')
  @UseGuards(TenantGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user profile and permissions' })
  @ApiResponse({ status: 200, description: 'Current user profile with permissions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
