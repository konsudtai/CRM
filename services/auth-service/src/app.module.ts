import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { UserRole } from './entities/user-role.entity';
import { ApiKey } from './entities/api-key.entity';
import { IpAllowlistEntry } from './entities/ip-allowlist-entry.entity';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { SecuritySettingsModule } from './modules/security-settings/security-settings.module';
import { RedisProvider, REDIS_CLIENT } from './providers/redis.provider';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'auth_service',
      entities: [Tenant, User, Role, RolePermission, UserRole, ApiKey, IpAllowlistEntry],
      migrations: [],
      synchronize: false,
      logging: process.env.DB_LOGGING === 'true',
    }),
    AuthModule,
    UsersModule,
    RolesModule,
    TenantModule,
    ApiKeysModule,
    SecuritySettingsModule,
  ],
  providers: [RedisProvider],
  exports: [REDIS_CLIENT],
})
export class AppModule {}
