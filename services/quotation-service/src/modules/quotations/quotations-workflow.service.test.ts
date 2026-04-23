import { QuotationsService } from './quotations.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('QuotationsService — workflow methods', () => {
  let service: QuotationsService;
  let mockQuotationRepo: any;
  let mockLineItemRepo: any;
  let mockProductRepo: any;
  let mockNumberingService: any;
  let mockPdfService: any;

  const TENANT = 'tenant-1';

  function makeQuotation(overrides: Record<string, any> = {}) {
    return {
      id: 'q-1',
      tenantId: TENANT,
      quotationNumber: '',
      status: 'draft',
      subtotal: 1000,
      totalDiscount: 50,
      approvedBy: null,
      lineItems: [],
      ...overrides,
    };
  }

  beforeEach(() => {
    mockQuotationRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((q) => Promise.resolve(q)),
    };
    mockLineItemRepo = {};
    mockProductRepo = {};
    mockNumberingService = {
      getNextNumber: jest.fn().mockResolvedValue('QT-2025-0001'),
    };
    mockPdfService = {
      generateAndUpload: jest.fn().mockResolvedValue('tenant-1/quotations/q-1.pdf'),
    };

    service = new QuotationsService(
      mockQuotationRepo as any,
      mockLineItemRepo as any,
      mockProductRepo as any,
      mockNumberingService as any,
      mockPdfService as any,
    );
  });

  describe('finalize', () => {
    it('assigns quotation number and sets status to sent when discount <= threshold', async () => {
      const q = makeQuotation({ subtotal: 1000, totalDiscount: 50 }); // 5% discount
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await service.finalize(TENANT, 'q-1');

      expect(mockNumberingService.getNextNumber).toHaveBeenCalledWith(TENANT, undefined);
      expect(q.quotationNumber).toBe('QT-2025-0001');
      expect(q.status).toBe('sent');
      expect(mockQuotationRepo.save).toHaveBeenCalledWith(q);
    });

    it('sets status to pending_approval when discount > threshold', async () => {
      const q = makeQuotation({ subtotal: 1000, totalDiscount: 150 }); // 15% discount
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await service.finalize(TENANT, 'q-1');

      expect(q.status).toBe('pending_approval');
    });

    it('uses custom discount threshold', async () => {
      const q = makeQuotation({ subtotal: 1000, totalDiscount: 60 }); // 6%
      mockQuotationRepo.findOne.mockResolvedValue(q);

      // With threshold of 5%, 6% should trigger approval
      await service.finalize(TENANT, 'q-1', 5);
      expect(q.status).toBe('pending_approval');
    });

    it('does not re-assign number if already assigned', async () => {
      const q = makeQuotation({ quotationNumber: 'QT-2025-0005', subtotal: 1000, totalDiscount: 0 });
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await service.finalize(TENANT, 'q-1');

      expect(mockNumberingService.getNextNumber).not.toHaveBeenCalled();
      expect(q.quotationNumber).toBe('QT-2025-0005');
    });

    it('throws NotFoundException for missing quotation', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(null);
      await expect(service.finalize(TENANT, 'q-1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for non-draft quotation', async () => {
      const q = makeQuotation({ status: 'sent' });
      mockQuotationRepo.findOne.mockResolvedValue(q);
      await expect(service.finalize(TENANT, 'q-1')).rejects.toThrow(BadRequestException);
    });

    it('handles zero subtotal without division error', async () => {
      const q = makeQuotation({ subtotal: 0, totalDiscount: 0 });
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await service.finalize(TENANT, 'q-1');
      expect(q.status).toBe('sent'); // 0% discount, no approval needed
    });
  });

  describe('updateStatus', () => {
    it('transitions draft → sent', async () => {
      const q = makeQuotation({ status: 'draft' });
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await service.updateStatus(TENANT, 'q-1', 'sent');
      expect(q.status).toBe('sent');
    });

    it('transitions sent → accepted', async () => {
      const q = makeQuotation({ status: 'sent' });
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await service.updateStatus(TENANT, 'q-1', 'accepted');
      expect(q.status).toBe('accepted');
    });

    it('rejects invalid transition draft → accepted', async () => {
      const q = makeQuotation({ status: 'draft' });
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await expect(
        service.updateStatus(TENANT, 'q-1', 'accepted'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects transition from terminal status', async () => {
      const q = makeQuotation({ status: 'accepted' });
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await expect(
        service.updateStatus(TENANT, 'q-1', 'draft'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for missing quotation', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus(TENANT, 'q-1', 'sent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    it('transitions pending_approval → sent and records approver', async () => {
      const q = makeQuotation({ status: 'pending_approval' });
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await service.approve(TENANT, 'q-1', 'manager-1');

      expect(q.status).toBe('sent');
      expect(q.approvedBy).toBe('manager-1');
      expect(mockQuotationRepo.save).toHaveBeenCalledWith(q);
    });

    it('throws BadRequestException if not pending_approval', async () => {
      const q = makeQuotation({ status: 'draft' });
      mockQuotationRepo.findOne.mockResolvedValue(q);

      await expect(
        service.approve(TENANT, 'q-1', 'manager-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for missing quotation', async () => {
      mockQuotationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.approve(TENANT, 'q-1', 'manager-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
