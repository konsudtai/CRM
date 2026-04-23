import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentRecord } from '../../entities/consent-record.entity';
import { Contact } from '../../entities/contact.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { CreateConsentDto } from './dto/create-consent.dto';

@Injectable()
export class ConsentService {
  constructor(
    @InjectRepository(ConsentRecord)
    private readonly consentRepo: Repository<ConsentRecord>,
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  async grantConsent(
    tenantId: string,
    userId: string,
    dto: CreateConsentDto,
  ): Promise<ConsentRecord> {
    const contact = await this.contactRepo.findOne({
      where: { id: dto.contactId, tenantId },
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const record = this.consentRepo.create({
      tenantId,
      contactId: dto.contactId,
      purpose: dto.purpose,
      status: 'granted' as const,
      grantedAt: new Date(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      withdrawnAt: null,
    });

    return this.consentRepo.save(record);
  }

  async withdrawConsent(
    tenantId: string,
    userId: string,
    consentId: string,
  ): Promise<ConsentRecord> {
    const original = await this.consentRepo.findOne({
      where: { id: consentId, tenantId },
    });
    if (!original) {
      throw new NotFoundException('Consent record not found');
    }

    // Create a NEW withdrawal record — never update the original
    const withdrawal = this.consentRepo.create({
      tenantId,
      contactId: original.contactId,
      purpose: original.purpose,
      status: 'withdrawn' as const,
      grantedAt: null,
      expiresAt: null,
      withdrawnAt: new Date(),
    });

    return this.consentRepo.save(withdrawal);
  }

  async findByContact(
    tenantId: string,
    contactId: string,
  ): Promise<ConsentRecord[]> {
    return this.consentRepo.find({
      where: { tenantId, contactId },
      order: { createdAt: 'DESC' },
    });
  }

  async requestPdpaDeletion(
    tenantId: string,
    userId: string,
    contactId: string,
  ): Promise<{ message: string }> {
    const contact = await this.contactRepo.findOne({
      where: { id: contactId, tenantId },
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Log the PDPA deletion request as an audit entry
    const auditEntry = this.auditLogRepo.create({
      tenantId,
      userId,
      entityType: 'contact',
      entityId: contactId,
      action: 'delete' as const,
      oldValues: { firstName: contact.firstName, lastName: contact.lastName },
      newValues: { pdpaDeletionRequested: true, requestedAt: new Date().toISOString() },
      ipAddress: null,
    });
    await this.auditLogRepo.save(auditEntry);

    return {
      message: `PDPA deletion request logged for contact ${contactId}. Deletion will be executed within 30 days.`,
    };
  }
}
