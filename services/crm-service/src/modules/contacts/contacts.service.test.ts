import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { Contact } from '../../entities/contact.entity';
import { Account } from '../../entities/account.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000010';

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: '00000000-0000-0000-0000-000000000020',
    tenantId: TENANT_ID,
    accountId: ACCOUNT_ID,
    firstName: 'สมชาย',
    lastName: 'ใจดี',
    title: 'ผู้จัดการ',
    phone: '0812345678',
    email: 'somchai@example.com',
    lineId: '@somchai',
    customFields: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    account: {} as Account,
    ...overrides,
  } as Contact;
}

describe('ContactsService', () => {
  let service: ContactsService;
  let contactRepo: Record<string, jest.Mock>;
  let accountRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    contactRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ ...makeContact(), ...entity })),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    accountRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: getRepositoryToken(Contact), useValue: contactRepo },
        { provide: getRepositoryToken(Account), useValue: accountRepo },
      ],
    }).compile();

    service = module.get(ContactsService);
  });

  describe('create', () => {
    it('should create a contact with LINE ID', async () => {
      accountRepo.findOne.mockResolvedValue({ id: ACCOUNT_ID, tenantId: TENANT_ID });

      const dto = {
        accountId: ACCOUNT_ID,
        firstName: 'สมหญิง',
        lastName: 'รักดี',
        lineId: '@somying',
      };

      const result = await service.create(TENANT_ID, dto);

      expect(contactRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          accountId: ACCOUNT_ID,
          firstName: 'สมหญิง',
          lastName: 'รักดี',
          lineId: '@somying',
        }),
      );
      expect(contactRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when account does not exist', async () => {
      accountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(TENANT_ID, {
          accountId: 'nonexistent',
          firstName: 'Test',
          lastName: 'User',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should default optional fields to null', async () => {
      accountRepo.findOne.mockResolvedValue({ id: ACCOUNT_ID, tenantId: TENANT_ID });

      await service.create(TENANT_ID, {
        accountId: ACCOUNT_ID,
        firstName: 'Min',
        lastName: 'Imal',
      });

      expect(contactRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: null,
          phone: null,
          email: null,
          lineId: null,
          customFields: {},
        }),
      );
    });
  });

  describe('findByAccount', () => {
    it('should return paginated contacts for an account', async () => {
      const contacts = [makeContact()];
      contactRepo.findAndCount.mockResolvedValue([contacts, 1]);

      const result = await service.findByAccount(TENANT_ID, ACCOUNT_ID);

      expect(result).toEqual({ data: contacts, total: 1, page: 1, limit: 20 });
      expect(contactRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID, accountId: ACCOUNT_ID },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should paginate correctly', async () => {
      contactRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByAccount(TENANT_ID, ACCOUNT_ID, 2, 10);

      expect(contactRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  describe('update', () => {
    it('should update only provided fields', async () => {
      const existing = makeContact();
      contactRepo.findOne.mockResolvedValue(existing);

      await service.update(TENANT_ID, existing.id, {
        lineId: '@new_line_id',
        phone: '0899999999',
      });

      expect(contactRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          lineId: '@new_line_id',
          phone: '0899999999',
        }),
      );
    });

    it('should throw NotFoundException when contact not found', async () => {
      contactRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, 'nonexistent', { firstName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
