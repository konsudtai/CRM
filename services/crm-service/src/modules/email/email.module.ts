import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { EmailSync } from '../../entities/email-sync.entity';
import { Contact } from '../../entities/contact.entity';
import { Activity } from '../../entities/activity.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { GmailService } from './gmail.service';
import { OutlookService } from './outlook.service';
import { EmailSyncService } from './email-sync.service';
import { EmailController } from './email.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmailSync, Contact, Activity]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [EmailController],
  providers: [GmailService, OutlookService, EmailSyncService, RedisProvider],
  exports: [EmailSyncService, GmailService, OutlookService],
})
export class EmailModule {}
