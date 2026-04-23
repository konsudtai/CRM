import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../providers/redis.provider';

export interface AssignmentResult {
  leadId: string;
  assignedTo: string;
}

@Injectable()
export class LeadAssignmentService {
  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {}

  /**
   * Round-robin assignment: cycles through active sales reps in consistent order.
   * Each rep gets ⌊N/M⌋ or ⌈N/M⌉ leads.
   * Uses a Redis counter per tenant to track position in the rotation.
   */
  async assignRoundRobin(
    tenantId: string,
    leadIds: string[],
    activeRepIds: string[],
  ): Promise<AssignmentResult[]> {
    if (activeRepIds.length === 0 || leadIds.length === 0) {
      return [];
    }

    const sortedReps = [...activeRepIds].sort();
    const m = sortedReps.length;
    const counterKey = `lead_assignment_counter:${tenantId}`;

    const results: AssignmentResult[] = [];

    for (const leadId of leadIds) {
      const counter = await this.redis.incr(counterKey);
      // counter starts at 1 after first incr, so use (counter - 1) % m
      const repIndex = (counter - 1) % m;
      results.push({
        leadId,
        assignedTo: sortedReps[repIndex],
      });
    }

    return results;
  }

  /**
   * Get the next rep in the round-robin rotation for a single lead.
   */
  async getNextRep(tenantId: string, activeRepIds: string[]): Promise<string | null> {
    if (activeRepIds.length === 0) {
      return null;
    }

    const sortedReps = [...activeRepIds].sort();
    const m = sortedReps.length;
    const counterKey = `lead_assignment_counter:${tenantId}`;

    const counter = await this.redis.incr(counterKey);
    const repIndex = (counter - 1) % m;
    return sortedReps[repIndex];
  }
}
