import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Activity } from '../../entities/activity.entity';
import { Account } from '../../entities/account.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { TimelineController } from './timeline.controller';
import { TimelineService } from './timeline.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Activity, Account]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [TimelineController],
  providers: [TimelineService, RedisProvider],
  exports: [TimelineService],
})
export class TimelineModule {}
