import { QuotationNumberingService } from './quotation-numbering.service';
import { DataSource } from 'typeorm';

describe('QuotationNumberingService', () => {
  let service: QuotationNumberingService;
  let mockManager: { query: jest.Mock };
  let mockDataSource: Partial<DataSource>;

  beforeEach(() => {
    mockManager = { query: jest.fn() };
    mockDataSource = {
      transaction: jest.fn((cb: any) => cb(mockManager)),
    };
    service = new QuotationNumberingService(mockDataSource as DataSource);
  });

  it('creates a new sequence row and returns 0001 for first quotation', async () => {
    // No existing row
    mockManager.query
      .mockResolvedValueOnce([]) // SELECT ... FOR UPDATE returns empty
      .mockResolvedValueOnce(undefined); // INSERT

    const result = await service.getNextNumber('tenant-1');
    const year = new Date().getFullYear();

    expect(result).toBe(`QT-${year}-0001`);
    expect(mockManager.query).toHaveBeenCalledTimes(2);

    // Verify SELECT query
    expect(mockManager.query.mock.calls[0][0]).toContain('FOR UPDATE');
    expect(mockManager.query.mock.calls[0][1]).toEqual(['tenant-1', 'QT', year]);

    // Verify INSERT query
    expect(mockManager.query.mock.calls[1][0]).toContain('INSERT INTO quotation_sequences');
    expect(mockManager.query.mock.calls[1][1]).toEqual(['tenant-1', 'QT', year, 1]);
  });

  it('increments existing sequence and returns padded number', async () => {
    mockManager.query
      .mockResolvedValueOnce([{ id: 'seq-1', current_value: 5 }]) // existing row
      .mockResolvedValueOnce(undefined); // UPDATE

    const result = await service.getNextNumber('tenant-1');
    const year = new Date().getFullYear();

    expect(result).toBe(`QT-${year}-0006`);
    expect(mockManager.query).toHaveBeenCalledTimes(2);

    // Verify UPDATE query
    expect(mockManager.query.mock.calls[1][0]).toContain('UPDATE quotation_sequences');
    expect(mockManager.query.mock.calls[1][1]).toEqual([6, 'seq-1']);
  });

  it('uses custom prefix when provided', async () => {
    mockManager.query
      .mockResolvedValueOnce([]) // no existing row
      .mockResolvedValueOnce(undefined); // INSERT

    const result = await service.getNextNumber('tenant-1', 'INV');
    const year = new Date().getFullYear();

    expect(result).toBe(`INV-${year}-0001`);
    expect(mockManager.query.mock.calls[0][1]).toEqual(['tenant-1', 'INV', year]);
  });

  it('pads numbers correctly for large sequences', async () => {
    mockManager.query
      .mockResolvedValueOnce([{ id: 'seq-1', current_value: 999 }])
      .mockResolvedValueOnce(undefined);

    const result = await service.getNextNumber('tenant-1');
    const year = new Date().getFullYear();

    expect(result).toBe(`QT-${year}-1000`);
  });

  it('handles sequences beyond 4 digits', async () => {
    mockManager.query
      .mockResolvedValueOnce([{ id: 'seq-1', current_value: 9999 }])
      .mockResolvedValueOnce(undefined);

    const result = await service.getNextNumber('tenant-1');
    const year = new Date().getFullYear();

    expect(result).toBe(`QT-${year}-10000`);
  });
});
