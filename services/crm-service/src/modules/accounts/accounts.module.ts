import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Account } from '../../entities/account.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account]),
    JwtModule.register({
      secret: (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET env var is required'); return s; })(),
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AccountsController],
  providers: [AccountsService, RedisProvider],
  exports: [AccountsService],
})
export class AccountsModule {}
