import { PdfGenerationService, TenantSettings } from './pdf-generation.service';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationLineItem } from '../../entities/quotation-line-item.entity';

describe('PdfGenerationService', () => {
  let service: PdfGenerationService;
  let mockS3Send: jest.Mock;

  const tenantSettings: TenantSettings = {
    companyName: 'Test Company',
    address: '123 Bangkok, Thailand',
    taxId: '0-1234-56789-00-0',
  };

  function buildQuotation(overrides?: Partial<Quotation>): Quotation {
    const lineItem = Object.assign(new QuotationLineItem(), {
      id: 'li-1',
      quotationId: 'q-1',
      productId: 'p-1',
      productName: 'Widget A',
      sku: 'WA-001',
      quantity: 2,
      unitPrice: 1000,
      discount: 50,
      discountType: 'fixed',
      whtRate: 3,
      lineTotal: 1950,
    });

    return Object.assign(new Quotation(), {
      id: 'q-1',
      tenantId: 'tenant-1',
      quotationNumber: 'QT-2025-0001',
      accountId: 'acc-1',
      contactId: null,
      opportunityId: null,
      subtotal: 1950,
      totalDiscount: 0,
      vatAmount: 136.5,
      whtAmount: 58.5,
      grandTotal: 2028,
      status: 'sent',
      pdfUrl: null,
      validUntil: new Date('2025-12-31'),
      createdBy: 'user-1',
      approvedBy: null,
      createdAt: new Date('2025-01-15'),
      updatedAt: new Date('2025-01-15'),
      lineItems: [lineItem],
      ...overrides,
    });
  }

  beforeEach(() => {
    mockS3Send = jest.fn().mockResolvedValue({});
    const mockS3 = { send: mockS3Send } as any;
    service = new PdfGenerationService(mockS3);
  });

  describe('generatePdf', () => {
    it('should generate a valid PDF buffer', async () => {
      const quotation = buildQuotation();
      const buffer = await service.generatePdf(quotation, tenantSettings);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
      // PDF files start with %PDF
      expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
    });

    it('should handle quotation with no line items', async () => {
      const quotation = buildQuotation({ lineItems: [] });
      const buffer = await service.generatePdf(quotation, tenantSettings);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.toString('ascii', 0, 5)).toBe('%PDF-');
    });

    it('should handle quotation with no validUntil date', async () => {
      const quotation = buildQuotation({ validUntil: null });
      const buffer = await service.generatePdf(quotation, tenantSettings);

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('generateAndUpload', () => {
    it('should upload PDF to S3 with correct tenant-prefixed key', async () => {
      const quotation = buildQuotation();
      const key = await service.generateAndUpload(quotation, tenantSettings);

      expect(key).toBe('tenant-1/quotations/q-1.pdf');
      expect(mockS3Send).toHaveBeenCalledTimes(1);

      const putCommand = mockS3Send.mock.calls[0][0];
      expect(putCommand.input.Key).toBe('tenant-1/quotations/q-1.pdf');
      expect(putCommand.input.ContentType).toBe('application/pdf');
      expect(putCommand.input.Body).toBeInstanceOf(Buffer);
    });

    it('should use default tenant settings when none provided', async () => {
      const quotation = buildQuotation();
      const key = await service.generateAndUpload(quotation);

      expect(key).toBe('tenant-1/quotations/q-1.pdf');
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });

    it('should propagate S3 upload errors', async () => {
      mockS3Send.mockRejectedValue(new Error('S3 failure'));
      const quotation = buildQuotation();

      await expect(
        service.generateAndUpload(quotation, tenantSettings),
      ).rejects.toThrow('S3 failure');
    });
  });
});
