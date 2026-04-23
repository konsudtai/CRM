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
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [PipelineController],
  providers: [PipelineService, RedisProvider],
  exports: [PipelineService],
})
export class PipelineModule {}
