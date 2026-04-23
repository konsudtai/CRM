import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { Account } from '../../entities/account.entity';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const USER_ID = '00000000-0000-0000-0000-000000000099';

function makeAccount(overrides: Partial<Account> = {}): Account {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    tenantId: TENANT_ID,
    companyName: 'บริษัท ทดสอบ จำกัด',
    industry: 'retail',
    taxId: '1234567890123',
    phone: '021234567',
    email: 'test@example.com',
    website: 'https://example.com',
    street: '123 ถนนสุขุมวิท',
    subDistrict: 'คลองเตย',
    district: 'คลองเตย',
    province: 'กรุงเทพมหานคร',
    postalCode: '10110',
    customFields: {},
    createdBy: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    contacts: [],
    accountTags: [],
    ...overrides,
  } as Account;
}

describe('AccountsService', () => {
  let service: AccountsService;
  let repo: Record<string, jest.Mock>;

  beforeEach(async () => {
    repo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ ...makeAccount(), ...entity })),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: getRepositoryToken(Account), useValue: repo },
      ],
    }).compile();

    service = module.get(AccountsService);
  });

  describe('create', () => {
    it('should create an account with Thai address fields', async () => {
      const dto = {
        companyName: 'บริษัท ใหม่ จำกัด',
        street: '456 ถนนพระราม 4',
        subDistrict: 'ลุมพินี',
        district: 'ปทุมวัน',
        province: 'กรุงเทพมหานคร',
        postalCode: '10330',
      };

      const result = await service.create(TENANT_ID, USER_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TENANT_ID,
          createdBy: USER_ID,
          companyName: 'บริษัท ใหม่ จำกัด',
          street: '456 ถนนพระราม 4',
          subDistrict: 'ลุมพินี',
          district: 'ปทุมวัน',
          province: 'กรุงเทพมหานคร',
          postalCode: '10330',
        }),
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.companyName).toBe('บริษัท ใหม่ จำกัด');
    });

    it('should default optional fields to null', async () => {
      const dto = { companyName: 'Minimal Corp' };

      await service.create(TENANT_ID, USER_ID, dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          industry: null,
          taxId: null,
          phone: null,
          email: null,
          website: null,
          street: null,
          subDistrict: null,
          district: null,
          province: null,
          postalCode: null,
          customFields: {},
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated accounts with defaults', async () => {
      const accounts = [makeAccount()];
      repo.findAndCount.mockResolvedValue([accounts, 1]);

      const result = await service.findAll(TENANT_ID);

      expect(result).toEqual({ data: accounts, total: 1, page: 1, limit: 20 });
      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: TENANT_ID },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('should filter by search (company name)', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(TENANT_ID, 1, 10, 'ทดสอบ');

      const call = repo.findAndCount.mock.calls[0][0];
      expect(call.where.companyName).toBeDefined();
    });

    it('should paginate correctly', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll(TENANT_ID, 3, 5);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });

  describe('findOne', () => {
    it('should return account with contacts', async () => {
      const account = makeAccount();
      repo.findOne.mockResolvedValue(account);

      const result = await service.findOne(TENANT_ID, account.id);

      expect(result).toEqual(account);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: account.id, tenantId: TENANT_ID },
        relations: ['contacts'],
      });
    });

    it('should throw NotFoundException when account not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne(TENANT_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update only provided fields', async () => {
      const existing = makeAccount();
      repo.findOne.mockResolvedValue(existing);

      await service.update(TENANT_ID, existing.id, {
        companyName: 'Updated Name',
        province: 'เชียงใหม่',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          companyName: 'Updated Name',
          province: 'เชียงใหม่',
        }),
      );
    });

    it('should throw NotFoundException when account not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(TENANT_ID, 'nonexistent', { companyName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('should soft-delete an existing account', async () => {
      const account = makeAccount();
      repo.findOne.mockResolvedValue(account);

      await service.softDelete(TENANT_ID, account.id);

      expect(repo.softDelete).toHaveBeenCalledWith(account.id);
    });

    it('should throw NotFoundException when account not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.softDelete(TENANT_ID, 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
