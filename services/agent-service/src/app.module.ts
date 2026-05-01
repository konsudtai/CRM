import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ChatModule } from './modules/chat/chat.module';
import { EventListenerModule } from './modules/events/event-listener.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';

@Module({
  imports: [
    JwtModule.register({
      secret: (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET env var is required'); return s; })(),
      signOptions: { expiresIn: '1h' },
    }),
    ChatModule,
    EventListenerModule,
    SchedulerModule,
  ],
})
export class AppModule {}
