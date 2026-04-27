import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.entity';
import { Role } from '../../entities/role.entity';
import { REDIS_CLIENT } from '../../providers/redis.provider';
import { CreateUserDto } from './dto/create-user.dto';

const BCRYPT_COST = 12;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async createUser(tenantId: string, dto: CreateUserDto): Promise<Omit<User, 'passwordHash'>> {
    // Check for duplicate email within tenant
    const existing = await this.userRepo.findOne({
      where: { tenantId, email: dto.email },
    });
    if (existing) {
      throw new ConflictException(`User with email "${dto.email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);

    const user = this.userRepo.create({
      tenantId,
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone || null,
      lineId: dto.lineId || null,
    });

    const saved = await this.userRepo.save(user);

    // Return without passwordHash
    const { passwordHash: _, ...result } = saved;
    return result as Omit<User, 'passwordHash'>;
  }

  async assignRoles(
    tenantId: string,
    userId: string,
    roleIds: string[],
  ): Promise<{ userId: string; roleIds: string[] }> {
    // Verify user exists in tenant
    const user = await this.userRepo.findOne({
      where: { id: userId, tenantId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify all roles exist in tenant
    if (roleIds.length > 0) {
      const roles = await this.roleRepo.find({
        where: { id: In(roleIds), tenantId },
      });
      if (roles.length !== roleIds.length) {
        throw new NotFoundException('One or more roles not found');
      }
    }

    // Replace all current role assignments
    await this.userRoleRepo.delete({ userId });

    if (roleIds.length > 0) {
      const userRoles = roleIds.map((roleId) =>
        this.userRoleRepo.create({ userId, roleId }),
      );
      await this.userRoleRepo.save(userRoles);
    }

    // Invalidate permission cache for this user
    await this.redis.del(`permissions:${userId}`);
    this.logger.log(`Assigned ${roleIds.length} roles to user=${userId}`);

    return { userId, roleIds };
  }

  async listUsers(tenantId: string, search?: string): Promise<Omit<User, 'passwordHash'>[]> {
    const qb = this.userRepo.createQueryBuilder('u')
      .where('u.tenant_id = :tenantId', { tenantId });
    if (search) {
      qb.andWhere('(u.email ILIKE :q OR u.first_name ILIKE :q OR u.last_name ILIKE :q)', { q: `%${search}%` });
    }
    qb.orderBy('u.created_at', 'DESC');
    const users = await qb.getMany();
    return users.map(({ passwordHash, ...rest }) => rest as Omit<User, 'passwordHash'>);
  }

  async getUser(tenantId: string, userId: string): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...rest } = user;
    return rest as Omit<User, 'passwordHash'>;
  }

  async updateUser(tenantId: string, userId: string, dto: Partial<CreateUserDto>): Promise<Omit<User, 'passwordHash'>> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    if (dto.firstName !== undefined) user.firstName = dto.firstName;
    if (dto.lastName !== undefined) user.lastName = dto.lastName;
    if (dto.phone !== undefined) user.phone = dto.phone || null;
    if (dto.lineId !== undefined) user.lineId = dto.lineId || null;
    const saved = await this.userRepo.save(user);
    const { passwordHash, ...rest } = saved;
    return rest as Omit<User, 'passwordHash'>;
  }

  async deactivateUser(tenantId: string, userId: string): Promise<{ id: string; isActive: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    await this.userRepo.save(user);
    await this.redis.del(`permissions:${userId}`);
    return { id: userId, isActive: false };
  }

  async activateUser(tenantId: string, userId: string): Promise<{ id: string; isActive: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = true;
    await this.userRepo.save(user);
    return { id: userId, isActive: true };
  }

  async resetPassword(tenantId: string, userId: string, newPassword: string): Promise<{ id: string; message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await this.userRepo.save(user);
    this.logger.log(`Password reset for user=${userId} by admin`);
    return { id: userId, message: 'Password reset successfully' };
  }
}
