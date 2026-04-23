/**
 * Quotation domain interfaces.
 */

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  sku: string;
  description?: string;
  unitPrice: number;
  unitOfMeasure: string;
  whtRate?: number;
  isActive: boolean;
}

export interface QuotationLineItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  whtRate: number;
  lineTotal: number;
}

export interface Quotation {
  id: string;
  tenantId: string;
  quotationNumber: string;
  accountId: string;
  contactId?: string;
  opportunityId?: string;
  lineItems: QuotationLineItem[];
  subtotal: number;
  totalDiscount: number;
  vatAmount: number;
  whtAmount: number;
  grandTotal: number;
  status: 'draft' | 'pending_approval' | 'sent' | 'accepted' | 'rejected' | 'expired';
  pdfUrl?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  validUntil?: Date;
}
