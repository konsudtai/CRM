import { DataSource } from 'typeorm';
import { PipelineStage } from '../entities/pipeline-stage.entity';

const DEFAULT_STAGES = [
  { name: 'New', sortOrder: 1, probability: 10, color: '#007AFF' },
  { name: 'Contacted', sortOrder: 2, probability: 20, color: '#5856D6' },
  { name: 'Qualified', sortOrder: 3, probability: 40, color: '#FF9500' },
  { name: 'Proposal', sortOrder: 4, probability: 60, color: '#34C759' },
  { name: 'Negotiation', sortOrder: 5, probability: 80, color: '#FF3B30' },
  { name: 'Won', sortOrder: 6, probability: 100, color: '#30D158' },
  { name: 'Lost', sortOrder: 7, probability: 0, color: '#8E8E93' },
];

/**
 * Seeds default pipeline stages for a given tenant.
 * Skips if stages already exist for the tenant.
 */
export async function seedDefaultPipelineStages(
  dataSource: DataSource,
  tenantId: string,
): Promise<PipelineStage[]> {
  const repo = dataSource.getRepository(PipelineStage);
  const existing = await repo.find({ where: { tenantId } });

  if (existing.length > 0) {
    return existing;
  }

  const stages = DEFAULT_STAGES.map((s) =>
    repo.create({ tenantId, ...s }),
  );
  return repo.save(stages);
}
