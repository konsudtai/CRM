import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentRecord } from '../../entities/consent-record.entity';
import { Contact } from '../../entities/contact.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { ConsentController } from './consent.controller';
import { ConsentService } from './consent.service';

@Module({
  imports: [TypeOrmModule.forFeature([ConsentRecord, Contact, AuditLog])],
  controllers: [ConsentController],
  providers: [ConsentService],
  exports: [ConsentService],
})
export class ConsentModule {}
