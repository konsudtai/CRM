import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CalendarSync } from '../../entities/calendar-sync.entity';
import { Activity } from '../../entities/activity.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { GoogleCalendarService } from './google-calendar.service';
import { MicrosoftCalendarService } from './microsoft-calendar.service';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarController } from './calendar.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarSync, Activity]),
    JwtModule.register({
      secret: (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET env var is required'); return s; })(),
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [CalendarController],
  providers: [GoogleCalendarService, MicrosoftCalendarService, CalendarSyncService, RedisProvider],
  exports: [CalendarSyncService, GoogleCalendarService, MicrosoftCalendarService],
})
export class CalendarModule {}
