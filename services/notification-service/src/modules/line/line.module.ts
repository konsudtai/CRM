import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../../entities/notification.entity';
import { LineService } from './line.service';
import { LineController } from './line.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Notification])],
  controllers: [LineController],
  providers: [LineService],
  exports: [LineService],
})
export class LineModule {}
