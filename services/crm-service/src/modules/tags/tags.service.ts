import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Tag } from '../../entities/tag.entity';
import { AccountTag } from '../../entities/account-tag.entity';
import { Account } from '../../entities/account.entity';
import { CreateTagDto } from './dto/create-tag.dto';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepo: Repository<Tag>,
    @InjectRepository(AccountTag)
    private readonly accountTagRepo: Repository<AccountTag>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async createTag(tenantId: string, dto: CreateTagDto): Promise<Tag> {
    const existing = await this.tagRepo.findOne({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(`Tag "${dto.name}" already exists`);
    }

    const tag = this.tagRepo.create({
      tenantId,
      name: dto.name,
      color: dto.color ?? null,
    });
    return this.tagRepo.save(tag);
  }

  async findAll(tenantId: string): Promise<Tag[]> {
    return this.tagRepo.find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
  }

  async assignTags(
    tenantId: string,
    accountId: string,
    tagIds: string[],
  ): Promise<Tag[]> {
    // Verify account exists
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Verify all tags belong to this tenant
    if (tagIds.length > 0) {
      const tags = await this.tagRepo.find({
        where: { id: In(tagIds), tenantId },
      });
      if (tags.length !== tagIds.length) {
        throw new NotFoundException('One or more tags not found');
      }
    }

    // Remove existing tags for this account
    await this.accountTagRepo.delete({ accountId });

    // Assign new tags
    if (tagIds.length > 0) {
      const accountTags = tagIds.map((tagId) =>
        this.accountTagRepo.create({ accountId, tagId }),
      );
      await this.accountTagRepo.save(accountTags);
    }

    return this.getAccountTags(tenantId, accountId);
  }

  async getAccountTags(tenantId: string, accountId: string): Promise<Tag[]> {
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const accountTags = await this.accountTagRepo.find({
      where: { accountId },
      relations: ['tag'],
    });

    return accountTags.map((at) => at.tag);
  }
}
