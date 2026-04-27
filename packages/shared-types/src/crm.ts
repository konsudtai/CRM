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

export interface Task {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  dueDate: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Open' | 'In Progress' | 'Completed' | 'Overdue';
  assignedTo?: string;
  accountId?: string;
  contactId?: string;
  opportunityId?: string;
  completedAt?: string;
  createdAt: string;
}

export interface CallLog {
  id: string;
  tenantId: string;
  duration: number;
  outcome: 'Connected' | 'No Answer' | 'Left Message' | 'Busy' | 'Wrong Number';
  notes?: string;
  accountId?: string;
  contactId?: string;
  userId: string;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: 'task' | 'appointment' | 'meeting';
  date: string;
  dueDate?: string;
  priority?: 'High' | 'Medium' | 'Low';
  status?: string;
}
