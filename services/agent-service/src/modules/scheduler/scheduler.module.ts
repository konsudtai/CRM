import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [ChatModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
