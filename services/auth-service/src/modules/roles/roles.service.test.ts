import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { Role } from '../../entities/role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { UserRole } from '../../entities/user-role.entity';
import { REDIS_CLIENT } from '../../providers/redis.provider';

const mockPipeline = {
  del: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
};

const mockRedis = {
  pipeline: jest.fn().mockReturnValue(mockPipeline),
};

const mockRoleRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data: any) => ({ id: 'role-new', ...data })),
  save: jest.fn((entity: any) => Promise.resolve({ id: 'role-new', ...entity })),
};

const mockRolePermissionRepo = {
  delete: jest.fn(),
  create: jest.fn((data: any) => data),
  save: jest.fn(),
};

const mockUserRoleRepo = {
  find: jest.fn(),
};

const TENANT_ID = 'tenant-1';

describe('RolesService', () => {
  let service: RolesService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: getRepositoryToken(RolePermission), useValue: mockRolePermissionRepo },
        { provide: getRepositoryToken(UserRole), useValue: mockUserRoleRepo },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<RolesService>(RolesService);
  });

  describe('createRole', () => {
    it('should create a role with permissions', async () => {
      mockRoleRepo.findOne
        .mockResolvedValueOnce(null) // no duplicate
        .mockResolvedValueOnce({
          id: 'role-new',
          tenantId: TENANT_ID,
          name: 'Custom Role',
          isDefault: false,
          permissions: [{ id: 'rp-1', roleId: 'role-new', module: 'leads', action: 'read' }],
        });

      const result = await service.createRole(TENANT_ID, {
        name: 'Custom Role',
        permissions: [{ module: 'leads', actions: ['read'] }],
      });

      expect(result.name).toBe('Custom Role');
      expect(mockRolePermissionRepo.delete).toHaveBeenCalledWith({ roleId: 'role-new' });
      expect(mockRolePermissionRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException on duplicate name', async () => {
      mockRoleRepo.findOne.mockResolvedValueOnce({ id: 'existing', name: 'Admin' });

      await expect(
        service.createRole(TENANT_ID, {
          name: 'Admin',
          permissions: [{ module: 'leads', actions: ['read'] }],
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateRole', () => {
    it('should update role name and invalidate cache', async () => {
      mockRoleRepo.findOne
        .mockResolvedValueOnce({ id: 'role-1', tenantId: TENANT_ID, name: 'Old Name' })
        .mockResolvedValueOnce(null) // no duplicate for new name
        .mockResolvedValueOnce({
          id: 'role-1',
          tenantId: TENANT_ID,
          name: 'New Name',
          permissions: [],
        });
      mockRoleRepo.save.mockResolvedValue({ id: 'role-1', name: 'New Name' });
      mockUserRoleRepo.find.mockResolvedValue([
        { userId: 'user-1', roleId: 'role-1' },
        { userId: 'user-2', roleId: 'role-1' },
      ]);

      const result = await service.updateRole(TENANT_ID, 'role-1', {
        name: 'New Name',
      });

      expect(result.name).toBe('New Name');
      expect(mockPipeline.del).toHaveBeenCalledWith('permissions:user-1');
      expect(mockPipeline.del).toHaveBeenCalledWith('permissions:user-2');
      expect(mockPipeline.exec).toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent role', async () => {
      mockRoleRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateRole(TENANT_ID, 'bad-id', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('listRoles', () => {
    it('should return all roles for tenant', async () => {
      const roles = [
        { id: 'r1', name: 'Admin', isDefault: true, permissions: [] },
        { id: 'r2', name: 'Custom', isDefault: false, permissions: [] },
      ];
      mockRoleRepo.find.mockResolvedValue(roles);

      const result = await service.listRoles(TENANT_ID);

      expect(result).toHaveLength(2);
      expect(mockRoleRepo.find).toHaveBeenCalledWith({
        where: { tenantId: TENANT_ID },
        relations: ['permissions'],
        order: { isDefault: 'DESC', name: 'ASC' },
      });
    });
  });
});
