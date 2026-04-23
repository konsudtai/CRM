import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { Product } from '../../entities/product.entity';

const mockProduct = {
  id: 'prod-1',
  tenantId: 'tenant-1',
  name: 'Widget A',
  sku: 'WA-001',
  description: 'A widget',
  unitPrice: 500,
  unitOfMeasure: 'piece',
  whtRate: 3,
  isActive: true,
  createdAt: new Date(),
};

describe('ProductsService', () => {
  let service: ProductsService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      create: jest.fn().mockImplementation((data) => ({ ...data })),
      save: jest.fn().mockImplementation((data) => Promise.resolve({ ...mockProduct, ...data })),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: repo },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('create', () => {
    it('creates a product with all fields', async () => {
      const dto = {
        name: 'Widget A',
        sku: 'WA-001',
        description: 'A widget',
        unitPrice: 500,
        unitOfMeasure: 'piece',
        whtRate: 3,
      };

      const result = await service.create('tenant-1', dto);

      expect(repo.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        name: 'Widget A',
        sku: 'WA-001',
        description: 'A widget',
        unitPrice: 500,
        unitOfMeasure: 'piece',
        whtRate: 3,
        isActive: true,
      });
      expect(repo.save).toHaveBeenCalled();
      expect(result.name).toBe('Widget A');
    });

    it('defaults isActive to true and whtRate to null', async () => {
      const dto = {
        name: 'Widget B',
        sku: 'WB-001',
        unitPrice: 100,
        unitOfMeasure: 'kg',
      };

      await service.create('tenant-1', dto);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          whtRate: null,
          description: null,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated products', async () => {
      repo.findAndCount.mockResolvedValue([[mockProduct], 1]);

      const result = await service.findAll('tenant-1', 1, 20);

      expect(result).toEqual({
        data: [mockProduct],
        total: 1,
        page: 1,
        limit: 20,
      });
    });

    it('filters by isActive', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll('tenant-1', 1, 20, true);

      expect(repo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', isActive: true },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a product', async () => {
      repo.findOne.mockResolvedValue(mockProduct);

      const result = await service.findOne('tenant-1', 'prod-1');
      expect(result).toEqual(mockProduct);
    });

    it('throws NotFoundException when product not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('tenant-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('updates product fields', async () => {
      repo.findOne.mockResolvedValue({ ...mockProduct });

      await service.update('tenant-1', 'prod-1', { name: 'Updated Widget' });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Widget' }),
      );
    });

    it('throws NotFoundException when product not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update('tenant-1', 'missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
