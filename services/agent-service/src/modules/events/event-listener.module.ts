import { Module } from '@nestjs/common';
import { EventListenerService } from './event-listener.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  providers: [EventListenerService],
})
export class EventListenerModule {}
