import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ConsentService } from './consent.service';
import { ConsentRecord } from '../../entities/consent-record.entity';
import { Contact } from '../../entities/contact.entity';
import { AuditLog } from '../../entities/audit-log.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000002';
const CONTACT_ID = '00000000-0000-0000-0000-000000000010';
const CONSENT_ID = '00000000-0000-0000-0000-000000000020';

function makeConsentRecord(overrides: Partial<ConsentRecord> = {}): ConsentRecord {
  return {
    id: CONSENT_ID,
    tenantId: TENANT_ID,
    contactId: CONTACT_ID,
    purpose: 'marketing',
    status: 'granted',
    grantedAt: new Date('2025-01-01'),
    expiresAt: new Date('2026-01-01'),
    withdrawnAt: null,
    createdAt: new Date(),
    ...overrides,
  } as ConsentRecord;
}

describe('ConsentService', () => {
  let service: ConsentService;
  let consentRepo: Record<string, jest.Mock>;
  let contactRepo: Record<string, jest.Mock>;
  let auditLogRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    consentRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: CONSENT_ID, createdAt: new Date(), ...entity })),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    contactRepo = {
      findOne: jest.fn(),
    };

    auditLogRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: 'audit-id', createdAt: new Date(), ...entity })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentService,
        { provide: getRepositoryToken(ConsentRecord), useValue: consentRepo },
        { provide: getRepositoryToken(Contact), useValue: contactRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditLogRepo },
      ],
    }).compile();

    service = module.get(ConsentService);
  });

  describe('grantConsent', () => {
    it('should create a consent record with status granted', async () => {
      contactRepo.findOne.mockResolvedValue({ id: CONTACT_ID, tenantId: TENANT_ID });

      const dto = { contactId: CONTACT_ID, purpose: 'marketing', expiresAt: '2026-01-01' };
      const result = await service.grantConsent(TENANT_ID, USER_ID, dto);

      expect(consentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          contactId: CONTACT_ID,
          purpose: 'marketing',
          status: 'granted',
          withdrawnAt: null,
        }),
      );
      expect(consentRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.status).toBe('granted');
    });

    it('should set grantedAt to current date', async () => {
      contactRepo.findOne.mockResolvedValue({ id: CONTACT_ID, tenantId: TENANT_ID });

      const dto = { contactId: CONTACT_ID, purpose: 'analytics' };
      await service.grantConsent(TENANT_ID, USER_ID, dto);

      expect(consentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          grantedAt: expect.any(Date),
          expiresAt: null,
        }),
      );
    });

    it('should throw NotFoundException when contact does not exist', async () => {
      contactRepo.findOne.mockResolvedValue(null);

      await expect(
        service.grantConsent(TENANT_ID, USER_ID, { contactId: 'nonexistent', purpose: 'marketing' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('withdrawConsent', () => {
    it('should create a new withdrawal record, not update the original', async () => {
      const original = makeConsentRecord();
      consentRepo.findOne.mockResolvedValue(original);

      const result = await service.withdrawConsent(TENANT_ID, USER_ID, CONSENT_ID);

      expect(consentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          contactId: CONTACT_ID,
          purpose: 'marketing',
          status: 'withdrawn',
          grantedAt: null,
          withdrawnAt: expect.any(Date),
        }),
      );
      expect(consentRepo.save).toHaveBeenCalled();
      expect(result.status).toBe('withdrawn');
    });

    it('should throw NotFoundException when consent record not found', async () => {
      consentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.withdrawConsent(TENANT_ID, USER_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByContact', () => {
    it('should return consent records ordered by createdAt DESC', async () => {
      const records = [makeConsentRecord(), makeConsentRecord({ status: 'withdrawn' })];
      consentRepo.find.mockResolvedValue(records);

      const result = await service.findByContact(TENANT_ID, CONTACT_ID);

      expect(result).toEqual(records);
      expect(consentRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID, contactId: CONTACT_ID },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('requestPdpaDeletion', () => {
    it('should log a PDPA deletion request in the audit log', async () => {
      contactRepo.findOne.mockResolvedValue({
        id: CONTACT_ID,
        tenantId: TENANT_ID,
        firstName: 'สมชาย',
        lastName: 'ใจดี',
      });

      const result = await service.requestPdpaDeletion(TENANT_ID, USER_ID, CONTACT_ID);

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          userId: USER_ID,
          entityType: 'contact',
          entityId: CONTACT_ID,
          action: 'delete',
        }),
      );
      expect(auditLogRepo.save).toHaveBeenCalled();
      expect(result.message).toContain(CONTACT_ID);
      expect(result.message).toContain('30 days');
    });

    it('should throw NotFoundException when contact not found', async () => {
      contactRepo.findOne.mockResolvedValue(null);

      await expect(
        service.requestPdpaDeletion(TENANT_ID, USER_ID, 'nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
