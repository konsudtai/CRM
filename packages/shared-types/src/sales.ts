/**
 * Sales domain interfaces — Leads and Pipeline.
 */

export interface Lead {
  id: string;
  tenantId: string;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  lineId?: string;
  source: string;
  status: string;
  assignedTo?: string;
  aiScore?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Opportunity {
  id: string;
  tenantId: string;
  dealName: string;
  accountId: string;
  contactId?: string;
  estimatedValue: number;
  stage: string;
  stageProbability: number;
  weightedValue: number;
  expectedCloseDate: Date;
  closedReason?: string;
  closedNotes?: string;
  assignedTo: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStage {
  id: string;
  tenantId: string;
  name: string;
  order: number;
  probability: number;
  color: string;
}

export interface SalesTarget {
  id: string;
  tenantId: string;
  userId: string;
  period: 'monthly' | 'quarterly';
  year: number;
  month?: number;
  quarter?: number;
  targetAmount: number;
  achievedAmount: number;
}
