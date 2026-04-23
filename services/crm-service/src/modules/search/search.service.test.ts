import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { OPENSEARCH_CLIENT } from '../../providers/opensearch.provider';

describe('SearchService', () => {
  let service: SearchService;
  let mockClient: any;

  beforeEach(async () => {
    mockClient = {
      indices: {
        exists: jest.fn(),
        create: jest.fn(),
      },
      index: jest.fn(),
      delete: jest.fn(),
      search: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: OPENSEARCH_CLIENT, useValue: mockClient },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  describe('ensureIndex', () => {
    it('should skip creation when index already exists', async () => {
      mockClient.indices.exists.mockResolvedValue({ body: true });

      await service.ensureIndex('tenant-1');

      expect(mockClient.indices.exists).toHaveBeenCalledWith({
        index: 'crm_tenant-1_global',
      });
      expect(mockClient.indices.create).not.toHaveBeenCalled();
    });

    it('should create index with Thai analyzer when it does not exist', async () => {
      mockClient.indices.exists.mockResolvedValue({ body: false });
      mockClient.indices.create.mockResolvedValue({ body: {} });

      await service.ensureIndex('tenant-1');

      expect(mockClient.indices.create).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'crm_tenant-1_global',
          body: expect.objectContaining({
            settings: expect.objectContaining({
              analysis: expect.objectContaining({
                analyzer: expect.objectContaining({
                  thai_analyzer: {
                    type: 'custom',
                    tokenizer: 'icu_tokenizer',
                    filter: ['lowercase', 'icu_folding'],
                  },
                }),
              }),
            }),
            mappings: expect.objectContaining({
              properties: expect.objectContaining({
                entity_type: { type: 'keyword' },
                tenant_id: { type: 'keyword' },
                title: expect.objectContaining({
                  type: 'text',
                  analyzer: 'thai_analyzer',
                }),
                body: { type: 'text', analyzer: 'thai_analyzer' },
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('indexDocument', () => {
    it('should index a document with correct fields', async () => {
      mockClient.indices.exists.mockResolvedValue({ body: true });
      mockClient.index.mockResolvedValue({ body: {} });

      await service.indexDocument(
        'tenant-1',
        'account',
        'entity-123',
        'บริษัท ทดสอบ จำกัด',
        'รายละเอียดบริษัท',
        ['vip', 'retail'],
      );

      expect(mockClient.index).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'crm_tenant-1_global',
          id: 'entity-123',
          body: expect.objectContaining({
            entity_type: 'account',
            entity_id: 'entity-123',
            tenant_id: 'tenant-1',
            title: 'บริษัท ทดสอบ จำกัด',
            body: 'รายละเอียดบริษัท',
            tags: ['vip', 'retail'],
          }),
          refresh: 'wait_for',
        }),
      );
    });
  });

  describe('removeDocument', () => {
    it('should delete a document by entityId', async () => {
      mockClient.delete.mockResolvedValue({ body: {} });

      await service.removeDocument('tenant-1', 'entity-123');

      expect(mockClient.delete).toHaveBeenCalledWith({
        index: 'crm_tenant-1_global',
        id: 'entity-123',
        refresh: 'wait_for',
      });
    });

    it('should silently ignore 404 on delete', async () => {
      mockClient.delete.mockRejectedValue({
        meta: { statusCode: 404 },
      });

      await expect(
        service.removeDocument('tenant-1', 'missing-id'),
      ).resolves.toBeUndefined();
    });
  });

  describe('search', () => {
    it('should return empty results when index does not exist', async () => {
      mockClient.indices.exists.mockResolvedValue({ body: false });

      const result = await service.search('tenant-1', 'test query');

      expect(result).toEqual({
        results: {},
        total: 0,
        page: 1,
        limit: 20,
      });
    });

    it('should return grouped results by entity type', async () => {
      mockClient.indices.exists.mockResolvedValue({ body: true });
      mockClient.search.mockResolvedValue({
        body: {
          hits: {
            total: { value: 2 },
            hits: [
              {
                _score: 5.2,
                _source: {
                  entity_type: 'account',
                  entity_id: 'acc-1',
                  title: 'บริษัท ABC',
                  body: 'รายละเอียด',
                  tags: ['vip'],
                },
              },
              {
                _score: 3.1,
                _source: {
                  entity_type: 'contact',
                  entity_id: 'con-1',
                  title: 'สมชาย ใจดี',
                  body: 'ผู้ติดต่อ',
                  tags: [],
                },
              },
            ],
          },
        },
      });

      const result = await service.search('tenant-1', 'บริษัท', 1, 20);

      expect(result.total).toBe(2);
      expect(result.results['account']).toHaveLength(1);
      expect(result.results['contact']).toHaveLength(1);
      expect(result.results['account'][0].entityId).toBe('acc-1');
      expect(result.results['contact'][0].entityId).toBe('con-1');
    });

    it('should use multi_match query with tenant filter', async () => {
      mockClient.indices.exists.mockResolvedValue({ body: true });
      mockClient.search.mockResolvedValue({
        body: { hits: { total: { value: 0 }, hits: [] } },
      });

      await service.search('tenant-1', 'test', 2, 10);

      expect(mockClient.search).toHaveBeenCalledWith(
        expect.objectContaining({
          index: 'crm_tenant-1_global',
          body: expect.objectContaining({
            from: 10,
            size: 10,
            query: {
              bool: {
                must: [
                  {
                    multi_match: {
                      query: 'test',
                      fields: ['title^2', 'body'],
                      type: 'best_fields',
                      fuzziness: 'AUTO',
                    },
                  },
                ],
                filter: [{ term: { tenant_id: 'tenant-1' } }],
              },
            },
          }),
        }),
      );
    });
  });
});
