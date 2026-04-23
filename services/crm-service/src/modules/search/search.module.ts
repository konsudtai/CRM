import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OpenSearchProvider } from '../../providers/opensearch.provider';
import { RedisProvider } from '../../providers/redis.provider';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [SearchController],
  providers: [SearchService, OpenSearchProvider, RedisProvider],
  exports: [SearchService],
})
export class SearchModule {}
