import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Activity } from '../../entities/activity.entity';
import { Task } from '../../entities/task.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Activity, Task]),
    JwtModule.register({
      secret: (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET env var is required'); return s; })(),
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, RedisProvider],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
