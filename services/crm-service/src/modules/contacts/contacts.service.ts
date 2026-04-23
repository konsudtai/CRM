import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from '../../entities/contact.entity';
import { Account } from '../../entities/account.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact)
    private readonly contactRepo: Repository<Contact>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async create(tenantId: string, dto: CreateContactDto): Promise<Contact> {
    // Verify account exists and belongs to tenant
    const account = await this.accountRepo.findOne({
      where: { id: dto.accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const contact = this.contactRepo.create({
      tenantId,
      accountId: dto.accountId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      title: dto.title ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      lineId: dto.lineId ?? null,
      customFields: dto.customFields ?? {},
    });
    return this.contactRepo.save(contact);
  }

  async findByAccount(
    tenantId: string,
    accountId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Contact[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.contactRepo.findAndCount({
      where: { tenantId, accountId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async update(tenantId: string, id: string, dto: UpdateContactDto): Promise<Contact> {
    const contact = await this.contactRepo.findOne({
      where: { id, tenantId },
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    Object.assign(contact, {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.email !== undefined && { email: dto.email }),
      ...(dto.lineId !== undefined && { lineId: dto.lineId }),
      ...(dto.customFields !== undefined && { customFields: dto.customFields }),
    });

    return this.contactRepo.save(contact);
  }
}
