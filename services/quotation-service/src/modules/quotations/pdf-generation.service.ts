import { Injectable, Inject, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import PDFDocument = require('pdfkit');
import { S3_CLIENT } from '../../providers/s3.provider';
import { Quotation } from '../../entities/quotation.entity';

const S3_BUCKET = process.env.S3_BUCKET || 'thai-smb-crm-files';

export interface TenantSettings {
  companyName: string;
  address: string;
  taxId: string;
  logoUrl?: string;
}

@Injectable()
export class PdfGenerationService {
  private readonly logger = new Logger(PdfGenerationService.name);

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
  ) {}

  /**
   * Generate a Thai quotation PDF and upload to S3.
   * Returns the S3 object key.
   */
  async generateAndUpload(
    quotation: Quotation,
    tenantSettings?: TenantSettings,
  ): Promise<string> {
    const settings = tenantSettings ?? this.getDefaultSettings();
    const pdfBuffer = await this.generatePdf(quotation, settings);
    const s3Key = `${quotation.tenantId}/quotations/${quotation.id}.pdf`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }),
    );

    this.logger.log(`PDF uploaded to s3://${S3_BUCKET}/${s3Key}`);
    return s3Key;
  }

  /**
   * Generate the PDF buffer for a quotation.
   */
  async generatePdf(
    quotation: Quotation,
    settings: TenantSettings,
  ): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.renderHeader(doc, settings);
      this.renderQuotationInfo(doc, quotation);
      this.renderLineItemsTable(doc, quotation);
      this.renderTotals(doc, quotation);
      this.renderFooter(doc);

      doc.end();
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument, settings: TenantSettings): void {
    doc.fontSize(18).text(settings.companyName, { align: 'center' });
    doc.fontSize(10).text(settings.address, { align: 'center' });
    doc.text(`Tax ID: ${settings.taxId}`, { align: 'center' });
    doc.moveDown(0.5);
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .stroke();
    doc.moveDown(0.5);
  }

  private renderQuotationInfo(doc: PDFKit.PDFDocument, q: Quotation): void {
    doc.fontSize(14).text('Quotation / ใบเสนอราคา', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(10);
    doc.text(`Quotation No: ${q.quotationNumber}`);
    doc.text(`Date: ${q.createdAt ? new Date(q.createdAt).toLocaleDateString('th-TH') : '-'}`);
    if (q.validUntil) {
      doc.text(`Valid Until: ${new Date(q.validUntil).toLocaleDateString('th-TH')}`);
    }
    doc.moveDown();
  }

  private renderLineItemsTable(doc: PDFKit.PDFDocument, q: Quotation): void {
    const lineItems = q.lineItems ?? [];
    const tableTop = doc.y;
    const colX = { no: 50, name: 75, sku: 200, qty: 280, price: 320, disc: 400, total: 470 };

    // Header row
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('#', colX.no, tableTop, { width: 20 });
    doc.text('Product', colX.name, tableTop, { width: 120 });
    doc.text('SKU', colX.sku, tableTop, { width: 75 });
    doc.text('Qty', colX.qty, tableTop, { width: 35, align: 'right' });
    doc.text('Unit Price', colX.price, tableTop, { width: 75, align: 'right' });
    doc.text('Discount', colX.disc, tableTop, { width: 65, align: 'right' });
    doc.text('Total', colX.total, tableTop, { width: 75, align: 'right' });

    doc.moveTo(50, tableTop + 14).lineTo(545, tableTop + 14).stroke();
    doc.font('Helvetica');

    let y = tableTop + 20;
    lineItems.forEach((item, i) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.fontSize(9);
      doc.text(`${i + 1}`, colX.no, y, { width: 20 });
      doc.text(item.productName, colX.name, y, { width: 120 });
      doc.text(item.sku, colX.sku, y, { width: 75 });
      doc.text(`${item.quantity}`, colX.qty, y, { width: 35, align: 'right' });
      doc.text(this.formatBaht(Number(item.unitPrice)), colX.price, y, { width: 75, align: 'right' });
      doc.text(this.formatBaht(Number(item.discount)), colX.disc, y, { width: 65, align: 'right' });
      doc.text(this.formatBaht(Number(item.lineTotal)), colX.total, y, { width: 75, align: 'right' });
      y += 16;
    });

    doc.y = y + 5;
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  }

  private renderTotals(doc: PDFKit.PDFDocument, q: Quotation): void {
    const x = 380;
    const valX = 470;
    const w = 75;

    doc.fontSize(10);
    doc.text('Subtotal:', x, doc.y, { continued: false });
    doc.text(this.formatBaht(Number(q.subtotal)), valX, doc.y - 12, { width: w, align: 'right' });

    doc.text('Discount:', x);
    doc.text(this.formatBaht(Number(q.totalDiscount)), valX, doc.y - 12, { width: w, align: 'right' });

    doc.text('VAT 7%:', x);
    doc.text(this.formatBaht(Number(q.vatAmount)), valX, doc.y - 12, { width: w, align: 'right' });

    doc.text('WHT:', x);
    doc.text(this.formatBaht(Number(q.whtAmount)), valX, doc.y - 12, { width: w, align: 'right' });

    doc.moveDown(0.3);
    doc.moveTo(x, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.3);

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text('Grand Total:', x);
    doc.text(`฿${this.formatBaht(Number(q.grandTotal))}`, valX, doc.y - 14, { width: w, align: 'right' });
    doc.font('Helvetica');
  }

  private renderFooter(doc: PDFKit.PDFDocument): void {
    doc.moveDown(2);
    doc.fontSize(9).text('This quotation is valid for the period specified above.', { align: 'center' });
    doc.text('Thank you for your business. / ขอบคุณที่ใช้บริการ', { align: 'center' });
  }

  private formatBaht(amount: number): string {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private getDefaultSettings(): TenantSettings {
    return {
      companyName: 'Company Name / ชื่อบริษัท',
      address: '123 Bangkok, Thailand',
      taxId: '0-0000-00000-00-0',
    };
  }
}
