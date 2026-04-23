import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Contact } from '../../entities/contact.entity';
import { Account } from '../../entities/account.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contact, Account]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [ContactsController],
  providers: [ContactsService, RedisProvider],
  exports: [ContactsService],
})
export class ContactsModule {}
