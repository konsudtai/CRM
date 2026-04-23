import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../../entities/role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { UserRole } from '../../entities/user-role.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisProvider } from '../../providers/redis.provider';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, RolePermission, UserRole]),
    AuthModule,
  ],
  controllers: [RolesController],
  providers: [RolesService, RedisProvider],
  exports: [RolesService],
})
export class RolesModule {}
