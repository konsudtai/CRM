import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload, decode } from 'jsonwebtoken';
import { User } from '../entities/user.entity';

/**
 * Cognito Auth Guard
 *
 * Validates the Cognito JWT token from Authorization header.
 * Looks up the user in our DB by cognito_sub.
 * Attaches user + tenant info to request.
 *
 * In production, use aws-jwt-verify or jwks-rsa to verify the token signature
 * against Cognito's JWKS endpoint. For now, we decode and trust API Gateway
 * to have already validated the token.
 */
@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private readonly logger = new Logger(CognitoAuthGuard.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);

    try {
      // Decode the Cognito JWT (API Gateway validates signature)
      const decoded = decode(token) as JwtPayload;
      if (!decoded || !decoded.sub) {
        throw new UnauthorizedException('Invalid token');
      }

      // Check token expiration
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        throw new UnauthorizedException('Token expired');
      }

      // Look up user by cognito_sub
      const user = await this.userRepo.findOne({
        where: { cognitoSub: decoded.sub },
        relations: ['userRoles', 'userRoles.role', 'userRoles.role.permissions'],
      });

      if (!user) {
        throw new UnauthorizedException('User not found in system');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('User account is deactivated');
      }

      // Build permissions array
      const permissions: string[] = [];
      if (user.userRoles) {
        for (const ur of user.userRoles) {
          if (ur.role?.permissions) {
            for (const p of ur.role.permissions) {
              permissions.push(`${p.module}:${p.action}`);
            }
          }
        }
      }

      // Attach to request
      request.user = {
        sub: user.id,
        cognitoSub: decoded.sub,
        email: decoded.email || user.email,
        tenantId: user.tenantId,
        roles: user.userRoles?.map(ur => ur.role?.name).filter(Boolean) || [],
        permissions: [...new Set(permissions)],
      };

      // Set tenant for RLS
      // This will be done by TenantGuard middleware

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.error(`Auth failed: ${error}`);
      throw new UnauthorizedException('Authentication failed');
    }
  }
}
