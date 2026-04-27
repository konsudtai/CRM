import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../providers/redis.provider';
import { IpAllowlistEntry } from '../entities/ip-allowlist-entry.entity';
import { Tenant } from '../entities/tenant.entity';

/**
 * IpAllowlistGuard checks whether the requesting IP is permitted
 * for the authenticated tenant. If the tenant has IP allowlisting
 * enabled (via tenant settings) and has entries in the allowlist,
 * only matching IPs are allowed through.
 *
 * Must run AFTER GatewayAuthGuard so that `request.user` is populated.
 *
 * Supports both individual IPs and CIDR notation.
 */
@Injectable()
export class IpAllowlistGuard implements CanActivate {
  private readonly logger = new Logger(IpAllowlistGuard.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectRepository(IpAllowlistEntry)
    private readonly ipAllowlistRepo: Repository<IpAllowlistEntry>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    if (!user?.tenantId) {
      // No tenant context — skip (auth guard should catch this)
      return true;
    }

    const tenantId = user.tenantId;

    // Check if IP allowlisting is enabled for this tenant
    const enabled = await this.isIpAllowlistEnabled(tenantId);
    if (!enabled) {
      return true;
    }

    // Get allowed IPs/CIDRs
    const allowedEntries = await this.getAllowedAddresses(tenantId);
    if (allowedEntries.length === 0) {
      // Allowlisting enabled but no entries — allow all (safe default)
      return true;
    }

    const clientIp = this.getClientIp(request);

    if (!clientIp) {
      this.logger.warn(`Could not determine client IP for tenant ${tenantId}`);
      throw new ForbiddenException('Unable to verify IP address');
    }

    const isAllowed = allowedEntries.some((entry) =>
      this.matchIp(clientIp, entry),
    );

    if (!isAllowed) {
      this.logger.warn(
        `IP ${clientIp} blocked for tenant ${tenantId}. Allowed: [${allowedEntries.join(', ')}]`,
      );
      throw new ForbiddenException(
        'Access denied: your IP address is not in the allowlist',
      );
    }

    return true;
  }

  private async isIpAllowlistEnabled(tenantId: string): Promise<boolean> {
    const cacheKey = `tenant:${tenantId}:ip_allowlist_enabled`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return cached === '1';
    }

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const enabled =
      tenant?.settings &&
      (tenant.settings as Record<string, unknown>).ipAllowlistEnabled === true;

    await this.redis.set(cacheKey, enabled ? '1' : '0', 'EX', this.CACHE_TTL);
    return !!enabled;
  }

  private async getAllowedAddresses(tenantId: string): Promise<string[]> {
    const cacheKey = `tenant:${tenantId}:ip_allowlist`;
    const cached = await this.redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached);
    }

    const entries = await this.ipAllowlistRepo.find({
      where: { tenantId },
      select: ['address'],
    });
    const addresses = entries.map((e) => e.address);

    await this.redis.set(
      cacheKey,
      JSON.stringify(addresses),
      'EX',
      this.CACHE_TTL,
    );
    return addresses;
  }

  /**
   * Extract client IP from request, handling proxied requests.
   */
  private getClientIp(request: Request): string | undefined {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
    return request.ip || request.socket?.remoteAddress;
  }

  /**
   * Check if a client IP matches an allowlist entry.
   * Supports exact IP match and CIDR notation.
   */
  matchIp(clientIp: string, allowlistEntry: string): boolean {
    // Normalize IPv6-mapped IPv4 (::ffff:127.0.0.1 → 127.0.0.1)
    const normalizedClient = this.normalizeIp(clientIp);
    const normalizedEntry = this.normalizeIp(allowlistEntry);

    if (!normalizedEntry.includes('/')) {
      // Exact match
      return normalizedClient === normalizedEntry;
    }

    // CIDR match
    return this.matchCidr(normalizedClient, normalizedEntry);
  }

  private normalizeIp(ip: string): string {
    // Strip CIDR suffix for normalization, then re-add
    const cidrMatch = ip.match(/^(.+)\/(\d+)$/);
    let base = cidrMatch ? cidrMatch[1] : ip;
    const suffix = cidrMatch ? `/${cidrMatch[2]}` : '';

    // Handle IPv6-mapped IPv4
    if (base.startsWith('::ffff:')) {
      base = base.substring(7);
    }

    return base + suffix;
  }

  private matchCidr(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = parseInt(bitsStr, 10);

    if (isNaN(bits)) return false;

    // Only handle IPv4 CIDR for now
    const ipNum = this.ipv4ToNumber(ip);
    const rangeNum = this.ipv4ToNumber(range);

    if (ipNum === null || rangeNum === null) return false;
    if (bits < 0 || bits > 32) return false;

    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipNum & mask) === (rangeNum & mask);
  }

  private ipv4ToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let num = 0;
    for (const part of parts) {
      const octet = parseInt(part, 10);
      if (isNaN(octet) || octet < 0 || octet > 255) return null;
      num = (num << 8) | octet;
    }
    return num >>> 0; // Ensure unsigned 32-bit
  }

  /**
   * Invalidate cached allowlist for a tenant (call after add/remove).
   */
  async invalidateCache(tenantId: string): Promise<void> {
    await this.redis.del(`tenant:${tenantId}:ip_allowlist`);
    await this.redis.del(`tenant:${tenantId}:ip_allowlist_enabled`);
  }
}
