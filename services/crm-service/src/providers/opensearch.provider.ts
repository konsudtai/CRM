import { Provider, Logger } from '@nestjs/common';

export const OPENSEARCH_CLIENT = 'OPENSEARCH_CLIENT';

/**
 * Null OpenSearch — stub when OPENSEARCH_ENABLED=false.
 * Search falls back to PostgreSQL ILIKE queries.
 */
class NullOpenSearch {
  private logger = new Logger('NullOpenSearch');
  constructor() { this.logger.warn('OpenSearch disabled — search uses PostgreSQL fallback'); }
  async index(): Promise<any> { return { result: 'noop' }; }
  async search(): Promise<any> { return { body: { hits: { total: { value: 0 }, hits: [] } } }; }
  async delete(): Promise<any> { return { result: 'noop' }; }
  async bulk(): Promise<any> { return { body: { errors: false, items: [] } }; }
  indices = { create: async () => ({}), exists: async () => ({ body: false }), delete: async () => ({}) };
}

export const OpenSearchProvider: Provider = {
  provide: OPENSEARCH_CLIENT,
  useFactory: () => {
    if (process.env.OPENSEARCH_ENABLED === 'true') {
      const { Client } = require('@opensearch-project/opensearch');
      return new Client({
        node: process.env.OPENSEARCH_ENDPOINT || 'http://localhost:9200',
        ssl: process.env.OPENSEARCH_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      });
    }
    return new NullOpenSearch() as any;
  },
};
