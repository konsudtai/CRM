import { Inject, Injectable, Logger } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { OPENSEARCH_CLIENT } from '../../providers/opensearch.provider';

export interface SearchDocument {
  entity_type: string;
  entity_id: string;
  tenant_id: string;
  title: string;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface SearchResultItem {
  entityType: string;
  entityId: string;
  title: string;
  body: string;
  tags: string[];
  score: number;
}

export interface GroupedSearchResults {
  [entityType: string]: SearchResultItem[];
}

export interface SearchResponse {
  results: GroupedSearchResults;
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @Inject(OPENSEARCH_CLIENT)
    private readonly client: Client,
  ) {}

  private indexName(tenantId: string): string {
    return `crm_${tenantId}_global`;
  }

  async ensureIndex(tenantId: string): Promise<void> {
    const index = this.indexName(tenantId);
    try {
      const { body: exists } = await this.client.indices.exists({ index });
      if (exists) return;

      await this.client.indices.create({
        index,
        body: {
          settings: {
            analysis: {
              analyzer: {
                thai_analyzer: {
                  type: 'custom',
                  tokenizer: 'icu_tokenizer',
                  filter: ['lowercase', 'icu_folding'],
                },
              },
            },
          },
          mappings: {
            properties: {
              entity_type: { type: 'keyword' },
              entity_id: { type: 'keyword' },
              tenant_id: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'thai_analyzer',
                fields: { keyword: { type: 'keyword' } },
              },
              body: { type: 'text', analyzer: 'thai_analyzer' },
              tags: { type: 'keyword' },
              created_at: { type: 'date' },
              updated_at: { type: 'date' },
            },
          },
        },
      });
      this.logger.log(`Created index ${index}`);
    } catch (error: any) {
      // Ignore resource_already_exists_exception (race condition)
      if (error?.meta?.body?.error?.type === 'resource_already_exists_exception') {
        return;
      }
      this.logger.error(`Failed to create index ${index}`, error);
      throw error;
    }
  }

  async indexDocument(
    tenantId: string,
    entityType: string,
    entityId: string,
    title: string,
    body: string,
    tags: string[] = [],
  ): Promise<void> {
    await this.ensureIndex(tenantId);
    const index = this.indexName(tenantId);
    const now = new Date().toISOString();

    await this.client.index({
      index,
      id: entityId,
      body: {
        entity_type: entityType,
        entity_id: entityId,
        tenant_id: tenantId,
        title,
        body,
        tags,
        created_at: now,
        updated_at: now,
      } satisfies SearchDocument,
      refresh: 'wait_for',
    });
  }

  async removeDocument(tenantId: string, entityId: string): Promise<void> {
    const index = this.indexName(tenantId);
    try {
      await this.client.delete({
        index,
        id: entityId,
        refresh: 'wait_for',
      });
    } catch (error: any) {
      // Ignore 404 — document may already be gone
      if (error?.meta?.statusCode === 404) return;
      throw error;
    }
  }

  async search(
    tenantId: string,
    query: string,
    page = 1,
    limit = 20,
  ): Promise<SearchResponse> {
    const index = this.indexName(tenantId);

    try {
      const { body: indexExists } = await this.client.indices.exists({ index });
      if (!indexExists) {
        return { results: {}, total: 0, page, limit };
      }
    } catch {
      return { results: {}, total: 0, page, limit };
    }

    const from = (page - 1) * limit;

    const { body } = await this.client.search({
      index,
      body: {
        from,
        size: limit,
        query: {
          bool: {
            must: [
              {
                multi_match: {
                  query,
                  fields: ['title^2', 'body'],
                  type: 'best_fields',
                  fuzziness: 'AUTO',
                },
              },
            ],
            filter: [{ term: { tenant_id: tenantId } }],
          },
        },
        sort: [{ _score: { order: 'desc' } }],
      },
    });

    const hits = body.hits?.hits || [];
    const total =
      typeof body.hits?.total === 'number'
        ? body.hits.total
        : body.hits?.total?.value ?? 0;

    const grouped: GroupedSearchResults = {};
    for (const hit of hits) {
      const src = hit._source as SearchDocument;
      const item: SearchResultItem = {
        entityType: src.entity_type,
        entityId: src.entity_id,
        title: src.title,
        body: src.body,
        tags: src.tags,
        score: Number(hit._score ?? 0),
      };
      if (!grouped[src.entity_type]) {
        grouped[src.entity_type] = [];
      }
      grouped[src.entity_type].push(item);
    }

    return { results: grouped, total, page, limit };
  }
}
