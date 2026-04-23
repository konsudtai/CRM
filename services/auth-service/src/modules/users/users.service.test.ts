import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.entity';
import { Role } from '../../entities/role.entity';
import { REDIS_CLIENT } from '../../providers/redis.provider';

const mockRedis = {
  del: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn((data: any) => ({ id: 'user-new', ...data })),
  save: jest.fn((entity: any) => Promise.resolve({ id: 'user-new', ...entity })),
};

const mockUserRoleRepo = {
  delete: jest.fn(),
  create: jest.fn((data: any) => data),
  save: jest.fn(),
};

const mockRoleRepo = {
  find: jest.fn(),
};

const TENANT_ID = 'tenant-1';

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserRole), useValue: mockUserRoleRepo },
        { provide: getRepositoryToken(Role), useValue: mockRoleRepo },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('createUser', () => {
    it('should create a user with hashed password', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await service.createUser(TENANT_ID, {
        email: 'new@example.com',
        password: 'securepass123',
        firstName: 'New',
        lastName: 'User',
      });

      expect(result.email).toBe('new@example.com');
      expect((result as any).passwordHash).toBeUndefined();
      expect(mockUserRepo.save).toHaveBeenCalled();
      // Verify the saved entity has a hashed password
      const savedArg = mockUserRepo.create.mock.calls[0][0];
      expect(savedArg.passwordHash).toBeDefined();
      expect(savedArg.passwordHash).not.toBe('securepass123');
    });

    it('should throw ConflictException on duplicate email', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createUser(TENANT_ID, {
          email: 'dup@example.com',
          password: 'pass12345678',
          firstName: 'Dup',
          lastName: 'User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('assignRoles', () => {
    it('should replace all role assignments and invalidate cache', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', tenantId: TENANT_ID });
      mockRoleRepo.find.mockResolvedValue([
        { id: 'role-1', tenantId: TENANT_ID },
        { id: 'role-2', tenantId: TENANT_ID },
      ]);

      const result = await service.assignRoles(TENANT_ID, 'user-1', ['role-1', 'role-2']);

      expect(result.userId).toBe('user-1');
      expect(result.roleIds).toEqual(['role-1', 'role-2']);
      expect(mockUserRoleRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(mockUserRoleRepo.save).toHaveBeenCalled();
      expect(mockRedis.del).toHaveBeenCalledWith('permissions:user-1');
    });

    it('should throw NotFoundException for non-existent user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assignRoles(TENANT_ID, 'bad-id', ['role-1']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if some roles do not exist', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', tenantId: TENANT_ID });
      mockRoleRepo.find.mockResolvedValue([{ id: 'role-1', tenantId: TENANT_ID }]);

      await expect(
        service.assignRoles(TENANT_ID, 'user-1', ['role-1', 'role-missing']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow assigning empty roles', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', tenantId: TENANT_ID });

      const result = await service.assignRoles(TENANT_ID, 'user-1', []);

      expect(result.roleIds).toEqual([]);
      expect(mockUserRoleRepo.delete).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(mockRedis.del).toHaveBeenCalledWith('permissions:user-1');
    });
  });
});
