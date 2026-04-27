import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Lead } from './entities/lead.entity';
import { Opportunity } from './entities/opportunity.entity';
import { PipelineStage } from './entities/pipeline-stage.entity';
import { SalesTarget } from './entities/sales-target.entity';
import { OpportunityHistory } from './entities/opportunity-history.entity';
import { LeadScore } from './entities/lead-score.entity';
import { RedisProvider, REDIS_CLIENT } from './providers/redis.provider';
import { LeadsModule } from './modules/leads/leads.module';
import { OpportunitiesModule } from './modules/opportunities/opportunities.module';
import { PipelineModule } from './modules/pipeline/pipeline.module';
import { TargetsModule } from './modules/targets/targets.module';
import { ReportsModule } from './modules/reports/reports.module';
import { EventBusModule } from './modules/event-bus/event-bus.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'sales_service',
      entities: [Lead, Opportunity, PipelineStage, SalesTarget, OpportunityHistory, LeadScore],
      migrations: [],
      synchronize: false,
      logging: process.env.DB_LOGGING === 'true',
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
    LeadsModule,
    OpportunitiesModule,
    PipelineModule,
    TargetsModule,
    ReportsModule,
    EventBusModule,
  ],
  providers: [RedisProvider],
  exports: [REDIS_CLIENT],
})
export class AppModule {}
