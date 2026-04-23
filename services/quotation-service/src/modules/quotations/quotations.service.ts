import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationLineItem } from '../../entities/quotation-line-item.entity';
import { Product } from '../../entities/product.entity';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { UpdateQuotationDto } from './dto/update-quotation.dto';
import {
  calculateQuotationTotals,
  LineItemInput,
  roundHalfUp,
} from './quotation-calc';
import { QuotationNumberingService } from './quotation-numbering.service';
import { PdfGenerationService, TenantSettings } from './pdf-generation.service';
import { isValidTransition } from './quotation-status';

/** Default discount threshold percentage for approval routing */
const DEFAULT_DISCOUNT_THRESHOLD = 10;

@Injectable()
export class QuotationsService {
  private readonly logger = new Logger(QuotationsService.name);

  constructor(
    @InjectRepository(Quotation)
    private readonly quotationRepo: Repository<Quotation>,
    @InjectRepository(QuotationLineItem)
    private readonly lineItemRepo: Repository<QuotationLineItem>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly numberingService: QuotationNumberingService,
    private readonly pdfService: PdfGenerationService,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    dto: CreateQuotationDto,
  ): Promise<Quotation> {
    // Look up all products
    const productIds = dto.lineItems.map((li) => li.productId);
    const products = await this.productRepo.find({
      where: { id: In(productIds), tenantId },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate all products exist
    for (const li of dto.lineItems) {
      if (!productMap.has(li.productId)) {
        throw new BadRequestException(
          `Product not found: ${li.productId}`,
        );
      }
    }

    const totalDiscount = roundHalfUp(dto.totalDiscount ?? 0);

    // Build line item inputs for calculation
    const calcInputs: LineItemInput[] = dto.lineItems.map((li) => {
      const product = productMap.get(li.productId)!;
      return {
        quantity: li.quantity,
        unitPrice: Number(product.unitPrice),
        discount: li.discount ?? 0,
        discountType: li.discountType ?? 'fixed',
        whtRate: Number(product.whtRate ?? 0),
      };
    });

    const totals = calculateQuotationTotals(calcInputs, totalDiscount);

    // Create quotation
    const quotation = this.quotationRepo.create({
      tenantId,
      quotationNumber: '', // Will be assigned on finalize
      accountId: dto.accountId,
      contactId: dto.contactId ?? null,
      opportunityId: dto.opportunityId ?? null,
      subtotal: totals.subtotal,
      totalDiscount,
      vatAmount: totals.vatAmount,
      whtAmount: totals.whtAmount,
      grandTotal: totals.grandTotal,
      status: 'draft',
      createdBy: userId,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
    });

    const savedQuotation = await this.quotationRepo.save(quotation);

    // Create line items
    const lineItems = dto.lineItems.map((li, index) => {
      const product = productMap.get(li.productId)!;
      const calcResult = totals.lineItems[index];
      return this.lineItemRepo.create({
        quotationId: savedQuotation.id,
        productId: li.productId,
        productName: product.name,
        sku: product.sku,
        quantity: li.quantity,
        unitPrice: Number(product.unitPrice),
        discount: li.discount ?? 0,
        discountType: li.discountType ?? 'fixed',
        whtRate: Number(product.whtRate ?? 0),
        lineTotal: calcResult.lineTotal,
      });
    });

    await this.lineItemRepo.save(lineItems);

    return this.findOne(tenantId, savedQuotation.id);
  }

  async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    status?: string,
  ): Promise<{ data: Quotation[]; total: number; page: number; limit: number }> {
    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const [data, total] = await this.quotationRepo.findAndCount({
      where,
      relations: ['lineItems'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string): Promise<Quotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id, tenantId },
      relations: ['lineItems'],
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }
    return quotation;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateQuotationDto,
  ): Promise<Quotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id, tenantId },
      relations: ['lineItems'],
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (dto.accountId !== undefined) quotation.accountId = dto.accountId;
    if (dto.contactId !== undefined) quotation.contactId = dto.contactId ?? null;
    if (dto.opportunityId !== undefined)
      quotation.opportunityId = dto.opportunityId ?? null;
    if (dto.validUntil !== undefined)
      quotation.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;

    const totalDiscount = roundHalfUp(
      dto.totalDiscount ?? Number(quotation.totalDiscount),
    );
    quotation.totalDiscount = totalDiscount;

    // If line items are provided, recalculate everything
    if (dto.lineItems && dto.lineItems.length > 0) {
      const productIds = dto.lineItems.map((li) => li.productId);
      const products = await this.productRepo.find({
        where: { id: In(productIds), tenantId },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      for (const li of dto.lineItems) {
        if (!productMap.has(li.productId)) {
          throw new BadRequestException(
            `Product not found: ${li.productId}`,
          );
        }
      }

      const calcInputs: LineItemInput[] = dto.lineItems.map((li) => {
        const product = productMap.get(li.productId)!;
        return {
          quantity: li.quantity,
          unitPrice: Number(product.unitPrice),
          discount: li.discount ?? 0,
          discountType: li.discountType ?? 'fixed',
          whtRate: Number(product.whtRate ?? 0),
        };
      });

      const totals = calculateQuotationTotals(calcInputs, totalDiscount);

      quotation.subtotal = totals.subtotal;
      quotation.vatAmount = totals.vatAmount;
      quotation.whtAmount = totals.whtAmount;
      quotation.grandTotal = totals.grandTotal;

      // Remove old line items and create new ones
      await this.lineItemRepo.delete({ quotationId: id });

      const newLineItems = dto.lineItems.map((li, index) => {
        const product = productMap.get(li.productId)!;
        const calcResult = totals.lineItems[index];
        return this.lineItemRepo.create({
          quotationId: id,
          productId: li.productId,
          productName: product.name,
          sku: product.sku,
          quantity: li.quantity,
          unitPrice: Number(product.unitPrice),
          discount: li.discount ?? 0,
          discountType: li.discountType ?? 'fixed',
          whtRate: Number(product.whtRate ?? 0),
          lineTotal: calcResult.lineTotal,
        });
      });

      await this.lineItemRepo.save(newLineItems);
    }

    await this.quotationRepo.save(quotation);
    return this.findOne(tenantId, id);
  }

  /**
   * Finalize a draft quotation: assign a sequential number and transition
   * to `sent` or `pending_approval` based on discount threshold.
   */
  async finalize(
    tenantId: string,
    id: string,
    discountThreshold = DEFAULT_DISCOUNT_THRESHOLD,
    prefix?: string,
  ): Promise<Quotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id, tenantId },
      relations: ['lineItems'],
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.status !== 'draft') {
      throw new BadRequestException(
        'Only draft quotations can be finalized',
      );
    }

    // Assign quotation number if not already assigned
    if (!quotation.quotationNumber) {
      quotation.quotationNumber = await this.numberingService.getNextNumber(
        tenantId,
        prefix,
      );
    }

    // Discount approval routing
    const subtotal = Number(quotation.subtotal);
    const totalDiscount = Number(quotation.totalDiscount);
    const discountPercent = subtotal > 0 ? (totalDiscount / subtotal) * 100 : 0;

    if (discountPercent > discountThreshold) {
      quotation.status = 'pending_approval';
    } else {
      quotation.status = 'sent';
    }

    await this.quotationRepo.save(quotation);

    // Generate PDF and store in S3
    try {
      const s3Key = await this.pdfService.generateAndUpload(quotation);
      quotation.pdfUrl = s3Key;
      await this.quotationRepo.save(quotation);
    } catch (err) {
      this.logger.error(`PDF generation failed for quotation ${id}`, err);
      // Continue — quotation is finalized even if PDF fails
    }

    return this.findOne(tenantId, id);
  }

  /**
   * Transition quotation status. Enforces the state machine.
   */
  async updateStatus(
    tenantId: string,
    id: string,
    newStatus: string,
  ): Promise<Quotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id, tenantId },
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (!isValidTransition(quotation.status, newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from '${quotation.status}' to '${newStatus}'`,
      );
    }

    quotation.status = newStatus;
    await this.quotationRepo.save(quotation);
    return this.findOne(tenantId, id);
  }

  /**
   * Manager approval: move from pending_approval → sent and record approver.
   */
  async approve(
    tenantId: string,
    id: string,
    approvedBy: string,
  ): Promise<Quotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id, tenantId },
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.status !== 'pending_approval') {
      throw new BadRequestException(
        'Only quotations with pending_approval status can be approved',
      );
    }

    quotation.status = 'sent';
    quotation.approvedBy = approvedBy;
    await this.quotationRepo.save(quotation);
    return this.findOne(tenantId, id);
  }

  /**
   * Mark quotation as sent and log delivery intent.
   * Actual delivery (email/LINE) is handled by notification-service.
   */
  async send(
    tenantId: string,
    id: string,
    channel: 'email' | 'line',
    recipient: string,
  ): Promise<Quotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id, tenantId },
    });
    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    if (quotation.status !== 'sent' && quotation.status !== 'pending_approval') {
      throw new BadRequestException(
        'Quotation must be finalized before sending',
      );
    }

    this.logger.log(
      `Delivery intent: quotation ${quotation.quotationNumber} via ${channel} to ${recipient}`,
    );

    // Mark as sent if not already
    if (quotation.status !== 'sent') {
      quotation.status = 'sent';
      await this.quotationRepo.save(quotation);
    }

    return this.findOne(tenantId, id);
  }
}
