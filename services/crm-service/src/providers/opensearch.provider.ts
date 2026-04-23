import { Provider } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';

export const OPENSEARCH_CLIENT = 'OPENSEARCH_CLIENT';

export const OpenSearchProvider: Provider = {
  provide: OPENSEARCH_CLIENT,
  useFactory: () => {
    const node = process.env.OPENSEARCH_NODE || 'http://localhost:9200';
    const client = new Client({
      node,
      ssl: process.env.OPENSEARCH_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      auth: process.env.OPENSEARCH_USERNAME
        ? {
            username: process.env.OPENSEARCH_USERNAME,
            password: process.env.OPENSEARCH_PASSWORD || '',
          }
        : undefined,
    });
    return client;
  },
};
