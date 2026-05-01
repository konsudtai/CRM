import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Account } from './entities/account.entity';
import { Contact } from './entities/contact.entity';
import { AccountShareholder } from './entities/account-shareholder.entity';
import { AccountDocument } from './entities/account-document.entity';
import { Note } from './entities/note.entity';
import { Attachment } from './entities/attachment.entity';
import { Tag } from './entities/tag.entity';
import { AccountTag } from './entities/account-tag.entity';
import { Activity } from './entities/activity.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Task } from './entities/task.entity';
import { ConsentRecord } from './entities/consent-record.entity';
import { EmailSync } from './entities/email-sync.entity';
import { CalendarSync } from './entities/calendar-sync.entity';
import { RedisProvider, REDIS_CLIENT } from './providers/redis.provider';
import { OpenSearchProvider, OPENSEARCH_CLIENT } from './providers/opensearch.provider';
import { S3Provider, S3_CLIENT } from './providers/s3.provider';
import { AccountsModule } from './modules/accounts/accounts.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { NotesModule } from './modules/notes/notes.module';
import { TimelineModule } from './modules/timeline/timeline.module';
import { TagsModule } from './modules/tags/tags.module';
import { SearchModule } from './modules/search/search.module';
import { AuditModule } from './modules/audit/audit.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { ConsentModule } from './modules/consent/consent.module';
import { EmailModule } from './modules/email/email.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { EventBusModule } from './modules/event-bus/event-bus.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'crm_service',
      entities: [Account, Contact, AccountShareholder, AccountDocument, Note, Attachment, Tag, AccountTag, Activity, AuditLog, Task, ConsentRecord, EmailSync, CalendarSync],
      migrations: [],
      synchronize: false,
      logging: process.env.DB_LOGGING === 'true',
    }),
    JwtModule.register({
      secret: (() => { const s = process.env.JWT_SECRET; if (!s) throw new Error('JWT_SECRET env var is required'); return s; })(),
      signOptions: { expiresIn: '1h' },
    }),
    AccountsModule,
    ContactsModule,
    NotesModule,
    TimelineModule,
    TagsModule,
    SearchModule,
    AuditModule,
    TasksModule,
    ActivitiesModule,
    ConsentModule,
    EmailModule,
    CalendarModule,
    EventBusModule,
  ],
  providers: [RedisProvider, OpenSearchProvider, S3Provider],
  exports: [REDIS_CLIENT, OPENSEARCH_CLIENT, S3_CLIENT],
})
export class AppModule {}
