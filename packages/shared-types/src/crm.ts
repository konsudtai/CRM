/**
 * CRM domain interfaces — Customer 360.
 */

export interface ThaiAddress {
  street?: string;
  subDistrict?: string; // ตำบล/แขวง
  district?: string; // อำเภอ/เขต
  province?: string; // จังหวัด
  postalCode?: string;
}

export interface Account {
  id: string;
  tenantId: string;
  companyName: string;
  industry: string;
  taxId?: string;
  phone?: string;
  email?: string;
  website?: string;
  address: ThaiAddress;
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Contact {
  id: string;
  tenantId: string;
  accountId: string;
  firstName: string;
  lastName: string;
  title?: string;
  phone?: string;
  email?: string;
  lineId?: string;
  tags: string[];
}

export interface TimelineEntry {
  id: string;
  entityType: 'call' | 'email' | 'meeting' | 'note' | 'deal_change' | 'task';
  entityId: string;
  summary: string;
  userId: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}
