/**
 * Pure quotation status state machine.
 *
 * Valid transitions:
 *   draft          → sent, pending_approval
 *   pending_approval → sent, draft
 *   sent           → accepted, rejected, expired
 *
 * All other transitions are invalid.
 */

export type QuotationStatus =
  | 'draft'
  | 'pending_approval'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired';

const VALID_TRANSITIONS: Record<string, QuotationStatus[]> = {
  draft: ['sent', 'pending_approval'],
  pending_approval: ['sent', 'draft'],
  sent: ['accepted', 'rejected', 'expired'],
};

/**
 * Returns true if transitioning from `from` to `to` is a valid status change.
 */
export function isValidTransition(
  from: string,
  to: string,
): boolean {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to as QuotationStatus);
}

/**
 * Returns the list of valid next statuses from the given status,
 * or an empty array if the status is terminal.
 */
export function getValidNextStatuses(from: string): QuotationStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}

/** All recognized quotation statuses. */
export const ALL_STATUSES: QuotationStatus[] = [
  'draft',
  'pending_approval',
  'sent',
  'accepted',
  'rejected',
  'expired',
];
