import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Product } from './entities/product.entity';
import { Quotation } from './entities/quotation.entity';
import { QuotationLineItem } from './entities/quotation-line-item.entity';
import { QuotationSequence } from './entities/quotation-sequence.entity';
import { RedisProvider, REDIS_CLIENT } from './providers/redis.provider';
import { S3Provider, S3_CLIENT } from './providers/s3.provider';
import { ProductsModule } from './modules/products/products.module';
import { QuotationsModule } from './modules/quotations/quotations.module';
import { EventBusModule } from './modules/event-bus/event-bus.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'quotation_service',
      entities: [Product, Quotation, QuotationLineItem, QuotationSequence],
      migrations: [],
      synchronize: false,
      logging: process.env.DB_LOGGING === 'true',
    }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
    ProductsModule,
    QuotationsModule,
    EventBusModule,
  ],
  providers: [RedisProvider, S3Provider],
  exports: [REDIS_CLIENT, S3_CLIENT],
})
export class AppModule {}
