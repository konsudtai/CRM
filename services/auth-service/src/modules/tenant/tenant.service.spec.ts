import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TenantService } from './tenant.service';
import { Tenant } from '../../entities/tenant.entity';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('TenantService', () => {
  let service: TenantService;
  const mockRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantService,
        { provide: getRepositoryToken(Tenant), useValue: mockRepo },
      ],
    }).compile();
    service = module.get(TenantService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all tenants', async () => {
      const tenants = [{ id: '1', name: 'Test', slug: 'test' }];
      mockRepo.find.mockResolvedValue(tenants);
      expect(await service.findAll()).toEqual(tenants);
    });
  });

  describe('findOne', () => {
    it('should return a tenant by id', async () => {
      const tenant = { id: '1', name: 'Test', slug: 'test' };
      mockRepo.findOne.mockResolvedValue(tenant);
      expect(await service.findOne('1')).toEqual(tenant);
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new tenant', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const created = { id: '1', name: 'New', slug: 'new', settings: {}, isActive: true };
      mockRepo.create.mockReturnValue(created);
      mockRepo.save.mockResolvedValue(created);
      const result = await service.create('New', 'new');
      expect(result.name).toBe('New');
    });

    it('should throw ConflictException if slug exists', async () => {
      mockRepo.findOne.mockResolvedValue({ id: '1', slug: 'existing' });
      await expect(service.create('Test', 'existing')).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update tenant name', async () => {
      const tenant = { id: '1', name: 'Old', slug: 'old', settings: {}, isActive: true };
      mockRepo.findOne.mockResolvedValue(tenant);
      mockRepo.save.mockResolvedValue({ ...tenant, name: 'Updated' });
      const result = await service.update('1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('updateLineConfig', () => {
    it('should update LINE channel config', async () => {
      const tenant = { id: '1', name: 'T', lineChannelToken: null, lineChannelSecret: null };
      mockRepo.findOne.mockResolvedValue(tenant);
      mockRepo.save.mockResolvedValue({ ...tenant, lineChannelToken: 'tok', lineChannelSecret: 'sec' });
      const result = await service.updateLineConfig('1', 'tok', 'sec');
      expect(result.lineChannelToken).toBe('tok');
    });
  });
});
