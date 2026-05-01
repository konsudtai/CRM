import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Opportunity } from '../../entities/opportunity.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { OpportunityHistory } from '../../entities/opportunity-history.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { OpportunitiesController } from './opportunities.controller';
import { OpportunitiesService } from './opportunities.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Opportunity, PipelineStage, OpportunityHistory]),
    JwtModule.register({
      secret: (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET env var is required'); return s; })(),
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService, RedisProvider],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
