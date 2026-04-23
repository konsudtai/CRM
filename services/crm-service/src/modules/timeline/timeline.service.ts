import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity } from '../../entities/activity.entity';
import { Account } from '../../entities/account.entity';

@Injectable()
export class TimelineService {
  constructor(
    @InjectRepository(Activity)
    private readonly activityRepo: Repository<Activity>,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
  ) {}

  async getTimeline(
    tenantId: string,
    accountId: string,
    page = 1,
    limit = 20,
  ): Promise<{ data: Activity[]; total: number; page: number; limit: number }> {
    // Verify account exists
    const account = await this.accountRepo.findOne({
      where: { id: accountId, tenantId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const [data, total] = await this.activityRepo.findAndCount({
      where: { tenantId, entityId: accountId },
      order: { timestamp: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }
}
