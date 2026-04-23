import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { REDIS_CLIENT } from '../../providers/redis.provider';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
};

const mockUserRepo = {
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockUserRoleRepo = {
  find: jest.fn().mockResolvedValue([]),
};

const mockQb = {
  where: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
};

const mockRolePermissionRepo = {
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-access-token'),
  decode: jest.fn(),
  verifyAsync: jest.fn(),
};

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'test@example.com',
    passwordHash: bcrypt.hashSync('correct-password', 12),
    firstName: 'Test',
    lastName: 'User',
    phone: null,
    lineId: null,
    mfaEnabled: false,
    mfaSecret: null,
    ssoProvider: null,
    ssoSubject: null,
    preferredLanguage: 'th',
    preferredCalendar: 'buddhist',
    isActive: true,
    lastLoginAt: null,
    createdAt: new Date(),
    tenant: {} as any,
    userRoles: [],
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(UserRole), useValue: mockUserRoleRepo },
        { provide: getRepositoryToken(RolePermission), useValue: mockRolePermissionRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      mockRedis.get.mockResolvedValue(null);

      const result = await service.login('test@example.com', 'correct-password') as any;

      expect(result.accessToken).toBe('mock-access-token');
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);
      expect(mockRedis.del).toHaveBeenCalledWith('lockout:tenant-1:test@example.com');
    });

    it('should throw on invalid email', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.login('bad@example.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw on wrong password and increment lockout counter', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockRedis.get.mockResolvedValue(null);
      mockRedis.incr.mockResolvedValue(1);

      await expect(service.login('test@example.com', 'wrong')).rejects.toThrow(UnauthorizedException);
      expect(mockRedis.incr).toHaveBeenCalledWith('lockout:tenant-1:test@example.com');
      expect(mockRedis.expire).toHaveBeenCalledWith('lockout:tenant-1:test@example.com', 900);
    });

    it('should throw ForbiddenException when account is locked', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockRedis.get.mockResolvedValue('5');

      await expect(service.login('test@example.com', 'correct-password')).rejects.toThrow(ForbiddenException);
    });

    it('should return mfaRequired when MFA is enabled', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser({ mfaEnabled: true, mfaSecret: 'secret' }));
      mockRedis.get.mockResolvedValue(null);

      const result = await service.login('test@example.com', 'correct-password') as any;

      expect(result.mfaRequired).toBe(true);
      expect(result.mfaToken).toBeDefined();
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringMatching(/^mfa:/),
        'user-1',
        'EX',
        300,
      );
    });

    it('should throw on inactive user', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser({ isActive: false }));
      await expect(service.login('test@example.com', 'correct-password')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should blacklist token in Redis', async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 600;
      mockJwtService.decode.mockReturnValue({ sub: 'user-1', exp: futureExp });

      await service.logout('some-token');

      expect(mockRedis.set).toHaveBeenCalledWith(
        'blacklist:some-token',
        '1',
        'EX',
        expect.any(Number),
      );
    });
  });

  describe('refresh', () => {
    it('should issue new tokens for valid refresh token', async () => {
      mockRedis.get.mockResolvedValue('user-1');
      mockUserRepo.findOne.mockResolvedValue(makeUser());

      const result = await service.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('mock-access-token');
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:valid-refresh-token');
    });

    it('should throw on invalid refresh token', async () => {
      mockRedis.get.mockResolvedValue(null);
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMe', () => {
    it('should return user profile with permissions', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      mockUserRoleRepo.find.mockResolvedValue([]);

      const result = await service.getMe('user-1');

      expect(result.id).toBe('user-1');
      expect(result.email).toBe('test@example.com');
      expect(result.permissions).toEqual([]);
    });

    it('should throw if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.getMe('nonexistent')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('isTokenBlacklisted', () => {
    it('should return true for blacklisted token', async () => {
      mockRedis.get.mockResolvedValue('1');
      expect(await service.isTokenBlacklisted('token')).toBe(true);
    });

    it('should return false for non-blacklisted token', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await service.isTokenBlacklisted('token')).toBe(false);
    });
  });
});
