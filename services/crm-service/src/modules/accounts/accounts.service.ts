import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Account } from '../../entities/account.entity';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateAccountDto): Promise<Account> {
    const account = this.accountRepo.create({
      tenantId,
      createdBy: userId,
      companyName: dto.companyName,
      industry: dto.industry ?? null,
      taxId: dto.taxId ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      website: dto.website ?? null,
      street: dto.street ?? null,
      subDistrict: dto.subDistrict ?? null,
      district: dto.district ?? null,
      province: dto.province ?? null,
      postalCode: dto.postalCode ?? null,
      customFields: dto.customFields ?? {},
    });
    return this.accountRepo.save(account);
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<{ data: Account[]; total: number; page: number; limit: number }> {
    const where: any = { tenantId };
    if (search) {
      where.companyName = ILike(`%${search}%`);
    }

    const [data, total] = await this.accountRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { id, tenantId },
      relations: ['contacts'],
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async update(tenantId: string, id: string, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { id, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    Object.assign(account, {
      ...(dto.companyName !== undefined && { companyName: dto.companyName }),
      ...(dto.industry !== undefined && { industry: dto.industry }),
      ...(dto.taxId !== undefined && { taxId: dto.taxId }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.website !== undefined && { website: dto.website }),
      ...(dto.street !== undefined && { street: dto.street }),
      ...(dto.subDistrict !== undefined && { subDistrict: dto.subDistrict }),
      ...(dto.district !== undefined && { district: dto.district }),
      ...(dto.province !== undefined && { province: dto.province }),
      ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
      ...(dto.customFields !== undefined && { customFields: dto.customFields }),
    });

    return this.accountRepo.save(account);
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const account = await this.accountRepo.findOne({
      where: { id, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    await this.accountRepo.softDelete(id);
  }
}
