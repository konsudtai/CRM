import {
  isValidTransition,
  getValidNextStatuses,
  ALL_STATUSES,
  QuotationStatus,
} from './quotation-status';

describe('Quotation Status State Machine', () => {
  describe('isValidTransition', () => {
    // Valid transitions from draft
    it('allows draft → sent', () => {
      expect(isValidTransition('draft', 'sent')).toBe(true);
    });

    it('allows draft → pending_approval', () => {
      expect(isValidTransition('draft', 'pending_approval')).toBe(true);
    });

    // Valid transitions from pending_approval
    it('allows pending_approval → sent', () => {
      expect(isValidTransition('pending_approval', 'sent')).toBe(true);
    });

    it('allows pending_approval → draft', () => {
      expect(isValidTransition('pending_approval', 'draft')).toBe(true);
    });

    // Valid transitions from sent
    it('allows sent → accepted', () => {
      expect(isValidTransition('sent', 'accepted')).toBe(true);
    });

    it('allows sent → rejected', () => {
      expect(isValidTransition('sent', 'rejected')).toBe(true);
    });

    it('allows sent → expired', () => {
      expect(isValidTransition('sent', 'expired')).toBe(true);
    });

    // Invalid transitions
    it('rejects draft → accepted', () => {
      expect(isValidTransition('draft', 'accepted')).toBe(false);
    });

    it('rejects sent → draft', () => {
      expect(isValidTransition('sent', 'draft')).toBe(false);
    });

    it('rejects accepted → sent', () => {
      expect(isValidTransition('accepted', 'sent')).toBe(false);
    });

    it('rejects rejected → draft', () => {
      expect(isValidTransition('rejected', 'draft')).toBe(false);
    });

    it('rejects expired → draft', () => {
      expect(isValidTransition('expired', 'draft')).toBe(false);
    });

    it('rejects unknown status as source', () => {
      expect(isValidTransition('unknown', 'sent')).toBe(false);
    });

    it('rejects self-transitions', () => {
      expect(isValidTransition('draft', 'draft')).toBe(false);
      expect(isValidTransition('sent', 'sent')).toBe(false);
    });
  });

  describe('getValidNextStatuses', () => {
    it('returns [sent, pending_approval] for draft', () => {
      expect(getValidNextStatuses('draft')).toEqual(['sent', 'pending_approval']);
    });

    it('returns [sent, draft] for pending_approval', () => {
      expect(getValidNextStatuses('pending_approval')).toEqual(['sent', 'draft']);
    });

    it('returns [accepted, rejected, expired] for sent', () => {
      expect(getValidNextStatuses('sent')).toEqual(['accepted', 'rejected', 'expired']);
    });

    it('returns empty array for terminal statuses', () => {
      expect(getValidNextStatuses('accepted')).toEqual([]);
      expect(getValidNextStatuses('rejected')).toEqual([]);
      expect(getValidNextStatuses('expired')).toEqual([]);
    });

    it('returns empty array for unknown status', () => {
      expect(getValidNextStatuses('bogus')).toEqual([]);
    });
  });

  describe('ALL_STATUSES', () => {
    it('contains all 6 statuses', () => {
      expect(ALL_STATUSES).toHaveLength(6);
      expect(ALL_STATUSES).toContain('draft');
      expect(ALL_STATUSES).toContain('pending_approval');
      expect(ALL_STATUSES).toContain('sent');
      expect(ALL_STATUSES).toContain('accepted');
      expect(ALL_STATUSES).toContain('rejected');
      expect(ALL_STATUSES).toContain('expired');
    });
  });
});
