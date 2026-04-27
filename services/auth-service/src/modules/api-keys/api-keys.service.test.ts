import * as crypto from 'crypto';
import { ApiKeysService } from './api-keys.service';
import { ApiKey } from '../../entities/api-key.entity';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let mockRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };

  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };
    service = new ApiKeysService(mockRepo as any);
  });

  describe('create', () => {
    it('should generate a key, hash it, and store the API key', async () => {
      const tenantId = 'tenant-1';
      const userId = 'user-1';
      const dto = { name: 'My Integration Key' };

      const savedKey = {
        id: 'key-id-1',
        tenantId,
        name: dto.name,
        keyHash: 'some-hash',
        keyPrefix: 'crm_abcd',
        status: 'active',
        expiresAt: null,
        createdBy: userId,
        createdAt: new Date(),
      };

      mockRepo.create.mockReturnValue(savedKey);
      mockRepo.save.mockResolvedValue(savedKey);

      const result = await service.create(tenantId, userId, dto);

      expect(result.id).toBe('key-id-1');
      expect(result.name).toBe('My Integration Key');
      expect(result.key).toBeDefined();
      expect(result.key.startsWith('crm_')).toBe(true);
      expect(result.key.length).toBe(68); // 'crm_' + 64 hex chars
      expect(result.keyPrefix).toBeDefined();
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId,
          name: dto.name,
          status: 'active',
          createdBy: userId,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should set expiresAt when provided', async () => {
      const dto = { name: 'Expiring Key', expiresAt: '2025-12-31T23:59:59Z' };
      const savedKey = {
        id: 'key-id-2',
        name: dto.name,
        keyHash: 'hash',
        keyPrefix: 'crm_1234',
        expiresAt: new Date(dto.expiresAt),
        createdAt: new Date(),
      };

      mockRepo.create.mockReturnValue(savedKey);
      mockRepo.save.mockResolvedValue(savedKey);

      const result = await service.create('t1', 'u1', dto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresAt: new Date(dto.expiresAt),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all API keys for a tenant ordered by createdAt DESC', async () => {
      const keys = [
        { id: '1', name: 'Key 1', keyPrefix: 'crm_aaaa', status: 'active' },
        { id: '2', name: 'Key 2', keyPrefix: 'crm_bbbb', status: 'revoked' },
      ];
      mockRepo.find.mockResolvedValue(keys);

      const result = await service.findAll('tenant-1');

      expect(result).toEqual(keys);
      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('revoke', () => {
    it('should set status to revoked', async () => {
      const apiKey = { id: 'key-1', tenantId: 'tenant-1', status: 'active' };
      mockRepo.findOne.mockResolvedValue(apiKey);
      mockRepo.save.mockResolvedValue({ ...apiKey, status: 'revoked' });

      await service.revoke('tenant-1', 'key-1');

      expect(apiKey.status).toBe('revoked');
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'revoked' }),
      );
    });

    it('should throw NotFoundException when key does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.revoke('tenant-1', 'nonexistent')).rejects.toThrow(
        'API key not found',
      );
    });
  });
});
