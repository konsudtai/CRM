import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RedisProvider, REDIS_CLIENT } from '../../providers/redis.provider';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { BedrockProvider } from './bedrock.provider';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AiController],
  providers: [AiService, BedrockProvider, RedisProvider],
  exports: [AiService],
})
export class AiModule {}
