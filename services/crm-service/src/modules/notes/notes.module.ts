import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Note } from '../../entities/note.entity';
import { Attachment } from '../../entities/attachment.entity';
import { Activity } from '../../entities/activity.entity';
import { Account } from '../../entities/account.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { S3Provider } from '../../providers/s3.provider';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Note, Attachment, Activity, Account]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [NotesController],
  providers: [NotesService, RedisProvider, S3Provider],
  exports: [NotesService],
})
export class NotesModule {}
