import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TOTP } from 'otplib';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { REDIS_CLIENT } from '../../providers/redis.provider';
import type { AuthTokenPayload } from '@thai-smb-crm/shared-types';

const BCRYPT_COST = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PERMISSION_CACHE_TTL_SECONDS = 30;
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes
const MFA_TOKEN_EXPIRY_SECONDS = 5 * 60; // 5 minutes
const ACCESS_TOKEN_EXPIRY_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    private readonly jwtService: JwtService,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  // ── Login ──────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    // Find user (bypass RLS — login is pre-auth)
    const user = await this.userRepo.findOne({
      where: { email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check lockout
    const lockoutKey = `lockout:${user.tenantId}:${email}`;
    const attempts = await this.redis.get(lockoutKey);
    if (attempts && parseInt(attempts, 10) >= LOCKOUT_MAX_ATTEMPTS) {
      throw new ForbiddenException(
        'Account locked due to too many failed attempts. Try again in 15 minutes.',
      );
    }

    // Validate password
    const valid = await bcrypt.compare(password, user.passwordHash || '');
    if (!valid) {
      const newCount = await this.redis.incr(lockoutKey);
      if (newCount === 1) {
        await this.redis.expire(lockoutKey, LOCKOUT_DURATION_SECONDS);
      }
      if (newCount >= LOCKOUT_MAX_ATTEMPTS) {
        // Ensure TTL is set when threshold is reached
        await this.redis.expire(lockoutKey, LOCKOUT_DURATION_SECONDS);
        // TODO: send lockout email notification via notification-service
      }
      throw new UnauthorizedException('Invalid email or password');
    }

    // Clear lockout counter on success
    await this.redis.del(lockoutKey);

    // If MFA is enabled, return a temporary MFA token instead of full JWT
    if (user.mfaEnabled) {
      const mfaToken = uuidv4();
      await this.redis.set(
        `mfa:${mfaToken}`,
        user.id,
        'EX',
        MFA_TOKEN_EXPIRY_SECONDS,
      );
      return { mfaRequired: true, mfaToken };
    }

    // Issue full tokens
    return this.issueTokens(user);
  }

  // ── MFA Verify ─────────────────────────────────────────────────────────

  async verifyMfa(mfaToken: string, code: string) {
    const userId = await this.redis.get(`mfa:${mfaToken}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired MFA token');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.mfaSecret) {
      throw new UnauthorizedException('MFA not configured for this user');
    }

    const totp = new TOTP();
    const isValid = await totp.verify(code, { secret: user.mfaSecret });

    if (!isValid) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    // Consume the MFA token
    await this.redis.del(`mfa:${mfaToken}`);

    return this.issueTokens(user);
  }

  // ── Logout ─────────────────────────────────────────────────────────────

  async logout(token: string) {
    // Decode without verification to get expiry for blacklist TTL
    const decoded = this.jwtService.decode(token) as AuthTokenPayload | null;
    if (!decoded || !decoded.exp) {
      return;
    }

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await this.redis.set(`blacklist:${token}`, '1', 'EX', ttl);
    }
  }

  // ── Refresh ────────────────────────────────────────────────────────────

  async refresh(refreshToken: string) {
    const userId = await this.redis.get(`refresh:${refreshToken}`);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Rotate: delete old refresh token, issue new pair
    await this.redis.del(`refresh:${refreshToken}`);

    return this.issueTokens(user);
  }

  // ── Get Current User ──────────────────────────────────────────────────

  async getMe(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const permissions = await this.resolvePermissions(user.id);

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      lineId: user.lineId,
      mfaEnabled: user.mfaEnabled,
      preferredLanguage: user.preferredLanguage,
      preferredCalendar: user.preferredCalendar,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      permissions,
    };
  }

  // ── Token Blacklist Check ─────────────────────────────────────────────

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.redis.get(`blacklist:${token}`);
    return result !== null;
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async issueTokens(user: User) {
    const { roles, permissions } = await this.resolveRolesAndPermissions(
      user.id,
    );

    const payload: Omit<AuthTokenPayload, 'iat' | 'exp'> = {
      sub: user.id,
      tenantId: user.tenantId,
      roles,
      permissions,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = uuidv4();
    await this.redis.set(
      `refresh:${refreshToken}`,
      user.id,
      'EX',
      REFRESH_TOKEN_EXPIRY_SECONDS,
    );

    // Update last_login_at
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });

    return {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  private async resolveRolesAndPermissions(
    userId: string,
  ): Promise<{ roles: string[]; permissions: string[] }> {
    // Check Redis cache first
    const cacheKey = `permissions:${userId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // Invalid cache entry, proceed to resolve from DB
      }
    }

    const userRoles = await this.userRoleRepo.find({
      where: { userId },
      relations: ['role'],
    });

    const roleNames = userRoles.map((ur) => ur.role.name);
    const roleIds = userRoles.map((ur) => ur.roleId);

    if (roleIds.length === 0) {
      const result = { roles: [], permissions: [] };
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', PERMISSION_CACHE_TTL_SECONDS);
      return result;
    }

    const rolePermissions = await this.rolePermissionRepo
      .createQueryBuilder('rp')
      .where('rp.role_id IN (:...roleIds)', { roleIds })
      .getMany();

    const permissionSet = new Set<string>();
    for (const rp of rolePermissions) {
      permissionSet.add(`${rp.module}:${rp.action}`);
    }

    const result = {
      roles: roleNames,
      permissions: Array.from(permissionSet),
    };

    // Cache with 30-second TTL
    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', PERMISSION_CACHE_TTL_SECONDS);

    return result;
  }

  private async resolvePermissions(userId: string): Promise<string[]> {
    const { permissions } = await this.resolveRolesAndPermissions(userId);
    return permissions;
  }
}
