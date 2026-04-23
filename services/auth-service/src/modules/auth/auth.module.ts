import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { TenantGuard } from '../../guards/tenant.guard';
import { RedisProvider } from '../../providers/redis.provider';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      signOptions: { expiresIn: '15m' },
    }),
    TypeOrmModule.forFeature([User, UserRole, RolePermission]),
  ],
  controllers: [AuthController],
  providers: [AuthService, TenantGuard, RedisProvider],
  exports: [JwtModule, TenantGuard, AuthService],
})
export class AuthModule {}
