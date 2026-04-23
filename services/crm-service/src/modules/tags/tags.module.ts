import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Tag } from '../../entities/tag.entity';
import { AccountTag } from '../../entities/account-tag.entity';
import { Account } from '../../entities/account.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tag, AccountTag, Account]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [TagsController],
  providers: [TagsService, RedisProvider],
  exports: [TagsService],
})
export class TagsModule {}
