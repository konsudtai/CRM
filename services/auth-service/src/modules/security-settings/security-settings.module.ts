import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../entities/tenant.entity';
import { IpAllowlistEntry } from '../../entities/ip-allowlist-entry.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisProvider } from '../../providers/redis.provider';
import { IpAllowlistGuard } from '../../guards/ip-allowlist.guard';
import { SecuritySettingsController } from './security-settings.controller';
import { SecuritySettingsService } from './security-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, IpAllowlistEntry]),
    AuthModule,
  ],
  controllers: [SecuritySettingsController],
  providers: [SecuritySettingsService, IpAllowlistGuard, RedisProvider],
  exports: [IpAllowlistGuard],
})
export class SecuritySettingsModule {}
