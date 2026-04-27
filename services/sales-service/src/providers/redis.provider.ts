import { Provider, Logger } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Null Redis — in-memory stub when REDIS_ENABLED=false.
 * Supports get/set/del/incr/expire/keys used by auth/roles/users services.
 */
class NullRedis {
  private store = new Map<string, { value: string; expireAt?: number }>();
  private logger = new Logger('NullRedis');

  constructor() { this.logger.warn('Redis disabled — using in-memory fallback (not for production scale)'); }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expireAt && Date.now() > entry.expireAt) { this.store.delete(key); return null; }
    return entry.value;
  }
  async set(key: string, value: string, ...args: any[]): Promise<'OK'> {
    let expireAt: number | undefined;
    // Handle SET key value EX seconds
    const exIdx = args.indexOf('EX');
    if (exIdx >= 0 && args[exIdx + 1]) expireAt = Date.now() + args[exIdx + 1] * 1000;
    this.store.set(key, { value, expireAt });
    return 'OK';
  }
  async del(key: string): Promise<number> { return this.store.delete(key) ? 1 : 0; }
  async incr(key: string): Promise<number> {
    const cur = parseInt(await this.get(key) || '0', 10);
    const next = cur + 1;
    const entry = this.store.get(key);
    this.store.set(key, { value: String(next), expireAt: entry?.expireAt });
    return next;
  }
  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expireAt = Date.now() + seconds * 1000;
    return 1;
  }
  async keys(pattern: string): Promise<string[]> { return [...this.store.keys()]; }
}

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    if (process.env.REDIS_ENABLED === 'true') {
      return new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10),
        lazyConnect: true,
      });
    }
    return new NullRedis() as any;
  },
};
