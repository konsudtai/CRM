import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Redis from 'ioredis';
import { Role } from '../../entities/role.entity';
import { RolePermission } from '../../entities/role-permission.entity';
import { UserRole } from '../../entities/user-role.entity';
import { REDIS_CLIENT } from '../../providers/redis.provider';
import { CreateRoleDto, PermissionDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  async createRole(tenantId: string, dto: CreateRoleDto): Promise<Role> {
    // Check for duplicate name within tenant
    const existing = await this.roleRepo.findOne({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Role "${dto.name}" already exists`);
    }

    const role = this.roleRepo.create({
      tenantId,
      name: dto.name,
      isDefault: false,
    });
    const savedRole = await this.roleRepo.save(role);

    await this.syncPermissions(savedRole.id, dto.permissions);

    return this.findRoleById(tenantId, savedRole.id);
  }

  async updateRole(
    tenantId: string,
    roleId: string,
    dto: UpdateRoleDto,
  ): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, tenantId },
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (dto.name && dto.name !== role.name) {
      const duplicate = await this.roleRepo.findOne({
        where: { tenantId, name: dto.name },
      });
      if (duplicate) {
        throw new ConflictException(`Role "${dto.name}" already exists`);
      }
      role.name = dto.name;
      await this.roleRepo.save(role);
    }

    if (dto.permissions) {
      await this.syncPermissions(roleId, dto.permissions);
    }

    // Invalidate Redis permission cache for all users with this role
    await this.invalidateCacheForRole(roleId);

    return this.findRoleById(tenantId, roleId);
  }

  async listRoles(tenantId: string): Promise<Role[]> {
    return this.roleRepo.find({
      where: { tenantId },
      relations: ['permissions'],
      order: { isDefault: 'DESC', name: 'ASC' },
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  private async findRoleById(tenantId: string, roleId: string): Promise<Role> {
    const role = await this.roleRepo.findOne({
      where: { id: roleId, tenantId },
      relations: ['permissions'],
    });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  private async syncPermissions(
    roleId: string,
    permissions: PermissionDto[],
  ): Promise<void> {
    // Remove existing permissions
    await this.rolePermissionRepo.delete({ roleId });

    // Create new permission entries
    const entities: RolePermission[] = [];
    for (const perm of permissions) {
      for (const action of perm.actions) {
        const rp = this.rolePermissionRepo.create({
          roleId,
          module: perm.module,
          action,
        });
        entities.push(rp);
      }
    }

    if (entities.length > 0) {
      await this.rolePermissionRepo.save(entities);
    }
  }

  private async invalidateCacheForRole(roleId: string): Promise<void> {
    const userRoles = await this.userRoleRepo.find({
      where: { roleId },
    });

    const pipeline = this.redis.pipeline();
    for (const ur of userRoles) {
      pipeline.del(`permissions:${ur.userId}`);
    }
    await pipeline.exec();

    this.logger.log(
      `Invalidated permission cache for ${userRoles.length} users (role=${roleId})`,
    );
  }
}
