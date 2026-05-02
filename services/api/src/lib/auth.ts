/**
 * JWT authentication — sign, verify, middleware.
 */
import { Context, Next } from 'hono';
import * as jose from 'jose';

const JWT_SECRET_KEY = () => new TextEncoder().encode(
  process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET env var is required'); })()
);

export interface TokenPayload {
  sub: string;       // user ID
  tenantId: string;
  email: string;
  roles: string[];
}

export async function signToken(payload: TokenPayload, expiresIn = '15m'): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET_KEY());
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jose.jwtVerify(token, JWT_SECRET_KEY());
  return payload as unknown as TokenPayload;
}

/**
 * Auth middleware — extracts JWT from Authorization header,
 * sets user context on c.set('user', ...) and c.set('tenantId', ...).
 */
export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ message: 'Missing or invalid Authorization header' }, 401);
  }

  try {
    const token = authHeader.slice(7);
    const payload = await verifyToken(token);
    c.set('user', payload);
    c.set('tenantId', payload.tenantId);
    c.set('userId', payload.sub);
    await next();
  } catch {
    return c.json({ message: 'Invalid or expired token' }, 401);
  }
}

/**
 * Require specific roles.
 */
export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user') as TokenPayload;
    if (!user || !roles.some(r => user.roles.includes(r))) {
      return c.json({ message: 'Insufficient permissions' }, 403);
    }
    await next();
  };
}
