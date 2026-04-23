import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationLineItem } from '../../entities/quotation-line-item.entity';
import { QuotationSequence } from '../../entities/quotation-sequence.entity';
import { Product } from '../../entities/product.entity';
import { RedisProvider } from '../../providers/redis.provider';
import { S3Provider } from '../../providers/s3.provider';
import { QuotationsController } from './quotations.controller';
import { QuotationsService } from './quotations.service';
import { QuotationNumberingService } from './quotation-numbering.service';
import { PdfGenerationService } from './pdf-generation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Quotation, QuotationLineItem, QuotationSequence, Product]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'dev-secret-change-me',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [QuotationsController],
  providers: [
    QuotationsService,
    QuotationNumberingService,
    PdfGenerationService,
    RedisProvider,
    S3Provider,
  ],
  exports: [QuotationsService],
})
export class QuotationsModule {}
