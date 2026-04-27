import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Opportunity } from '../../entities/opportunity.entity';
import { Lead } from '../../entities/lead.entity';
import { PipelineStage } from '../../entities/pipeline-stage.entity';
import { SalesTarget } from '../../entities/sales-target.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Opportunity, Lead, PipelineStage, SalesTarget])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
