import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Lead } from '../../entities/lead.entity';

export interface DuplicateMatch {
  leadId: string;
  matchedFields: string[];
}

@Injectable()
export class DuplicateDetectionService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
  ) {}

  /**
   * Normalize a string for comparison: lowercase and collapse whitespace.
   */
  static normalize(value: string | null | undefined): string | null {
    if (!value || value.trim() === '') return null;
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Find potential duplicate leads for a given lead within the same tenant.
   * Matches by email (case-insensitive), phone (whitespace-normalized),
   * or company name (case-insensitive, whitespace-normalized).
   */
  async findDuplicates(tenantId: string, leadId: string): Promise<DuplicateMatch[]> {
    const sourceLead = await this.leadRepo.findOne({
      where: { id: leadId, tenantId },
    });

    if (!sourceLead) {
      return [];
    }

    const normalizedEmail = DuplicateDetectionService.normalize(sourceLead.email);
    const normalizedPhone = DuplicateDetectionService.normalize(sourceLead.phone);
    const normalizedCompany = DuplicateDetectionService.normalize(sourceLead.companyName);

    // If the source lead has no matchable fields, no duplicates possible
    if (!normalizedEmail && !normalizedPhone && !normalizedCompany) {
      return [];
    }

    // Fetch all other leads in the same tenant
    const otherLeads = await this.leadRepo.find({
      where: { tenantId, id: Not(leadId) },
    });

    const duplicates: DuplicateMatch[] = [];

    for (const candidate of otherLeads) {
      const matchedFields: string[] = [];

      if (
        normalizedEmail &&
        DuplicateDetectionService.normalize(candidate.email) === normalizedEmail
      ) {
        matchedFields.push('email');
      }

      if (
        normalizedPhone &&
        DuplicateDetectionService.normalize(candidate.phone) === normalizedPhone
      ) {
        matchedFields.push('phone');
      }

      if (
        normalizedCompany &&
        DuplicateDetectionService.normalize(candidate.companyName) === normalizedCompany
      ) {
        matchedFields.push('companyName');
      }

      if (matchedFields.length > 0) {
        duplicates.push({ leadId: candidate.id, matchedFields });
      }
    }

    return duplicates;
  }
}
