/**
 * Pure financial calculation functions for quotations.
 * All amounts are rounded to 2 decimal places using half-up rounding.
 *
 * Formulas:
 *   discount_amount:
 *     if discountType === 'percentage': unit_price * quantity * discount / 100
 *     else (fixed): discount
 *   line_total = (quantity * unit_price) - discount_amount
 *   subtotal = sum(line_totals)
 *   vat_amount = (subtotal - total_discount) * 0.07
 *   wht_amount = sum(line_total * wht_rate / 100)
 *   grand_total = subtotal - total_discount + vat_amount - wht_amount
 */

const VAT_RATE = 0.07;

/**
 * Round a number to 2 decimal places using half-up rounding.
 */
export function roundHalfUp(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface LineItemInput {
  quantity: number;
  unitPrice: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  whtRate: number;
}

export interface LineItemCalcResult {
  discountAmount: number;
  lineTotal: number;
}

export interface QuotationCalcResult {
  lineItems: LineItemCalcResult[];
  subtotal: number;
  vatAmount: number;
  whtAmount: number;
  grandTotal: number;
}

export function calculateLineItem(item: LineItemInput): LineItemCalcResult {
  const discountAmount =
    item.discountType === 'percentage'
      ? roundHalfUp(item.unitPrice * item.quantity * item.discount / 100)
      : roundHalfUp(item.discount);

  const lineTotal = roundHalfUp(item.quantity * item.unitPrice - discountAmount);

  return { discountAmount, lineTotal };
}

export function calculateQuotationTotals(
  items: LineItemInput[],
  totalDiscount: number,
): QuotationCalcResult {
  const lineResults = items.map((item) => calculateLineItem(item));

  const subtotal = roundHalfUp(
    lineResults.reduce((sum, lr) => sum + lr.lineTotal, 0),
  );

  const vatAmount = roundHalfUp((subtotal - totalDiscount) * VAT_RATE);

  const whtAmount = roundHalfUp(
    items.reduce((sum, item, i) => {
      return sum + lineResults[i].lineTotal * item.whtRate / 100;
    }, 0),
  );

  const grandTotal = roundHalfUp(subtotal - totalDiscount + vatAmount - whtAmount);

  return {
    lineItems: lineResults,
    subtotal,
    vatAmount,
    whtAmount,
    grandTotal,
  };
}
