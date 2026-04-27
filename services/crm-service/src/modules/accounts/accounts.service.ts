import { Injectable, NotFoundException } from '@nestjs/common';
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
      companyNameEn: dto.companyNameEn ?? null,
      companyType: dto.companyType ?? null,
      industry: dto.industry ?? null,
      businessDesc: dto.businessDesc ?? null,
      taxId: dto.taxId ?? null,
      branchCode: dto.branchCode ?? '00000',
      branchName: dto.branchName ?? null,
      registeredCapital: dto.registeredCapital ?? null,
      registrationDate: dto.registrationDate ?? null,
      registrationNo: dto.registrationNo ?? null,
      phone: dto.phone ?? null,
      phone2: dto.phone2 ?? null,
      fax: dto.fax ?? null,
      email: dto.email ?? null,
      website: dto.website ?? null,
      lineOaId: dto.lineOaId ?? null,
      address: dto.address ?? null,
      subDistrict: dto.subDistrict ?? null,
      district: dto.district ?? null,
      province: dto.province ?? null,
      postalCode: dto.postalCode ?? null,
      accountSource: dto.accountSource ?? null,
      accountTier: dto.accountTier ?? 'standard',
      creditTerm: dto.creditTerm ?? 30,
      creditLimit: dto.creditLimit ?? null,
      paymentMethod: dto.paymentMethod ?? null,
      internalNotes: dto.internalNotes ?? null,
      customFields: dto.customFields ?? {},
    });
    return this.accountRepo.save(account);
  }

  async findAll(tenantId: string, page = 1, limit = 20, search?: string) {
    const qb = this.accountRepo.createQueryBuilder('a')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.deleted_at IS NULL');

    if (search) {
      qb.andWhere(
        '(a.company_name ILIKE :q OR a.company_name_en ILIKE :q OR a.tax_id ILIKE :q OR a.email ILIKE :q OR a.phone ILIKE :q)',
        { q: `%${search}%` },
      );
    }

    qb.orderBy('a.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Account> {
    const account = await this.accountRepo.findOne({
      where: { id, tenantId },
      relations: ['contacts'],
    });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async update(tenantId: string, id: string, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.accountRepo.findOne({ where: { id, tenantId } });
    if (!account) throw new NotFoundException('Account not found');

    // Update only provided fields
    const fields = [
      'companyName','companyNameEn','companyType','industry','businessDesc',
      'taxId','branchCode','branchName','registeredCapital','registrationDate','registrationNo',
      'phone','phone2','fax','email','website','lineOaId',
      'address','subDistrict','district','province','postalCode',
      'shippingAddress','shippingSubDistrict','shippingDistrict','shippingProvince','shippingPostalCode',
      'accountOwner','accountStatus','accountSource','accountTier',
      'creditTerm','creditLimit','paymentMethod','internalNotes','customFields',
    ];
    for (const f of fields) {
      if ((dto as any)[f] !== undefined) (account as any)[f] = (dto as any)[f];
    }

    return this.accountRepo.save(account);
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const account = await this.accountRepo.findOne({ where: { id, tenantId } });
    if (!account) throw new NotFoundException('Account not found');
    await this.accountRepo.softDelete(id);
  }
}
