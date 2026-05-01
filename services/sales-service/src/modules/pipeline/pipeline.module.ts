import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { Opportunity } from '../../entities/opportunity.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { PipelineController } from './pipeline.controller';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PipelineStage, Opportunity]),
    JwtModule.register({
      secret: (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET env var is required'); return s; })(),
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [PipelineController],
  providers: [PipelineService, RedisProvider],
  exports: [PipelineService],
})
export class PipelineModule {}
