import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.entity';
import { Role } from '../../entities/role.entity';
import { AuthModule } from '../auth/auth.module';
import { RedisProvider } from '../../providers/redis.provider';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserRole, Role]),
    AuthModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, RedisProvider],
  exports: [UsersService],
})
export class UsersModule {}
