import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Lead } from '../../entities/lead.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { LeadAssignmentService } from './lead-assignment.service';
import { DuplicateDetectionService } from './duplicate-detection.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, PipelineStage]),
    JwtModule.register({
      secret: (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET env var is required'); return s; })(),
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [LeadsController],
  providers: [LeadsService, LeadAssignmentService, DuplicateDetectionService, RedisProvider],
  exports: [LeadsService, LeadAssignmentService, DuplicateDetectionService],
})
export class LeadsModule {}
