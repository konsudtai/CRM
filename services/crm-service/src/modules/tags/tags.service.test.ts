import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { TagsService } from './tags.service';
import { Tag } from '../../entities/tag.entity';
import { AccountTag } from '../../entities/account-tag.entity';
import { Account } from '../../entities/account.entity';

describe('TagsService', () => {
  let service: TagsService;

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const accountId = '22222222-2222-2222-2222-222222222222';

  const mockTagRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: any) => data),
    save: jest.fn((data: any) => Promise.resolve({ id: 'tag-1', ...data })),
  };

  const mockAccountTagRepo = {
    find: jest.fn(),
    create: jest.fn((data: any) => data),
    save: jest.fn((data: any) => Promise.resolve(data)),
    delete: jest.fn(),
  };

  const mockAccountRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: getRepositoryToken(Tag), useValue: mockTagRepo },
        { provide: getRepositoryToken(AccountTag), useValue: mockAccountTagRepo },
        { provide: getRepositoryToken(Account), useValue: mockAccountRepo },
      ],
    }).compile();

    service = module.get<TagsService>(TagsService);
    jest.clearAllMocks();
  });

  describe('createTag', () => {
    it('should create a new tag', async () => {
      mockTagRepo.findOne.mockResolvedValue(null);

      const result = await service.createTag(tenantId, {
        name: 'VIP',
        color: '#ff0000',
      });

      expect(result).toMatchObject({ name: 'VIP', color: '#ff0000' });
    });

    it('should throw ConflictException for duplicate tag name', async () => {
      mockTagRepo.findOne.mockResolvedValue({ id: 'existing', name: 'VIP' });

      await expect(
        service.createTag(tenantId, { name: 'VIP' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all tags for tenant', async () => {
      const tags = [
        { id: 't1', tenantId, name: 'A', color: null },
        { id: 't2', tenantId, name: 'B', color: '#00f' },
      ];
      mockTagRepo.find.mockResolvedValue(tags);

      const result = await service.findAll(tenantId);
      expect(result).toHaveLength(2);
    });
  });

  describe('assignTags', () => {
    it('should replace account tags', async () => {
      mockAccountRepo.findOne.mockResolvedValue({ id: accountId, tenantId });
      mockTagRepo.find.mockResolvedValue([
        { id: 'tag-1', tenantId },
        { id: 'tag-2', tenantId },
      ]);
      mockAccountTagRepo.find.mockResolvedValue([
        { accountId, tagId: 'tag-1', tag: { id: 'tag-1', name: 'A' } },
        { accountId, tagId: 'tag-2', tag: { id: 'tag-2', name: 'B' } },
      ]);

      const result = await service.assignTags(tenantId, accountId, [
        'tag-1',
        'tag-2',
      ]);

      expect(mockAccountTagRepo.delete).toHaveBeenCalledWith({ accountId });
      expect(mockAccountTagRepo.save).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException if account not found', async () => {
      mockAccountRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assignTags(tenantId, accountId, ['tag-1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if tag not found', async () => {
      mockAccountRepo.findOne.mockResolvedValue({ id: accountId, tenantId });
      mockTagRepo.find.mockResolvedValue([]); // no matching tags

      await expect(
        service.assignTags(tenantId, accountId, ['nonexistent']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should clear all tags when empty array provided', async () => {
      mockAccountRepo.findOne.mockResolvedValue({ id: accountId, tenantId });
      mockAccountTagRepo.find.mockResolvedValue([]);

      const result = await service.assignTags(tenantId, accountId, []);

      expect(mockAccountTagRepo.delete).toHaveBeenCalledWith({ accountId });
      expect(result).toHaveLength(0);
    });
  });
});
