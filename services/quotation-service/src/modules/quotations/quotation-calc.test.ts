import {
  roundHalfUp,
  calculateLineItem,
  calculateQuotationTotals,
  LineItemInput,
} from './quotation-calc';

describe('roundHalfUp', () => {
  it('rounds 1.005 up to 1.01', () => {
    // Note: 1.005 is a classic floating-point edge case
    expect(roundHalfUp(1.005)).toBe(1.01);
  });

  it('rounds 1.004 down to 1.0', () => {
    expect(roundHalfUp(1.004)).toBe(1.0);
  });

  it('rounds 0 to 0', () => {
    expect(roundHalfUp(0)).toBe(0);
  });

  it('rounds negative values', () => {
    expect(roundHalfUp(-1.555)).toBe(-1.55);
  });

  it('keeps already-2-decimal values unchanged', () => {
    expect(roundHalfUp(99.99)).toBe(99.99);
  });
});

describe('calculateLineItem', () => {
  it('calculates with zero discount (fixed)', () => {
    const item: LineItemInput = {
      quantity: 10,
      unitPrice: 100,
      discount: 0,
      discountType: 'fixed',
      whtRate: 3,
    };
    const result = calculateLineItem(item);
    expect(result.discountAmount).toBe(0);
    expect(result.lineTotal).toBe(1000);
  });

  it('calculates with fixed discount', () => {
    const item: LineItemInput = {
      quantity: 5,
      unitPrice: 200,
      discount: 50,
      discountType: 'fixed',
      whtRate: 0,
    };
    const result = calculateLineItem(item);
    expect(result.discountAmount).toBe(50);
    // 5 * 200 - 50 = 950
    expect(result.lineTotal).toBe(950);
  });

  it('calculates with percentage discount', () => {
    const item: LineItemInput = {
      quantity: 3,
      unitPrice: 1000,
      discount: 10,
      discountType: 'percentage',
      whtRate: 5,
    };
    const result = calculateLineItem(item);
    // discount_amount = 1000 * 3 * 10 / 100 = 300
    expect(result.discountAmount).toBe(300);
    // line_total = 3 * 1000 - 300 = 2700
    expect(result.lineTotal).toBe(2700);
  });

  it('handles fractional amounts with rounding', () => {
    const item: LineItemInput = {
      quantity: 3,
      unitPrice: 33.33,
      discount: 15,
      discountType: 'percentage',
      whtRate: 2,
    };
    const result = calculateLineItem(item);
    // discount_amount = 33.33 * 3 * 15 / 100 = 14.9985 → 15.0
    expect(result.discountAmount).toBe(15.0);
    // line_total = 3 * 33.33 - 15.0 = 99.99 - 15.0 = 84.99
    expect(result.lineTotal).toBe(84.99);
  });
});

describe('calculateQuotationTotals', () => {
  it('calculates a single line item with no discounts', () => {
    const items: LineItemInput[] = [
      {
        quantity: 10,
        unitPrice: 500,
        discount: 0,
        discountType: 'fixed',
        whtRate: 3,
      },
    ];
    const result = calculateQuotationTotals(items, 0);

    expect(result.subtotal).toBe(5000);
    // vat = 5000 * 0.07 = 350
    expect(result.vatAmount).toBe(350);
    // wht = 5000 * 3 / 100 = 150
    expect(result.whtAmount).toBe(150);
    // grand = 5000 - 0 + 350 - 150 = 5200
    expect(result.grandTotal).toBe(5200);
  });

  it('calculates multiple line items with mixed discounts', () => {
    const items: LineItemInput[] = [
      {
        quantity: 2,
        unitPrice: 1000,
        discount: 10,
        discountType: 'percentage',
        whtRate: 3,
      },
      {
        quantity: 5,
        unitPrice: 200,
        discount: 100,
        discountType: 'fixed',
        whtRate: 0,
      },
    ];
    const result = calculateQuotationTotals(items, 0);

    // Line 1: discount = 1000*2*10/100 = 200, total = 2000-200 = 1800
    // Line 2: discount = 100, total = 1000-100 = 900
    expect(result.lineItems[0].lineTotal).toBe(1800);
    expect(result.lineItems[1].lineTotal).toBe(900);

    // subtotal = 1800 + 900 = 2700
    expect(result.subtotal).toBe(2700);
    // vat = 2700 * 0.07 = 189
    expect(result.vatAmount).toBe(189);
    // wht = 1800 * 3/100 + 900 * 0/100 = 54
    expect(result.whtAmount).toBe(54);
    // grand = 2700 - 0 + 189 - 54 = 2835
    expect(result.grandTotal).toBe(2835);
  });

  it('applies total discount correctly', () => {
    const items: LineItemInput[] = [
      {
        quantity: 1,
        unitPrice: 10000,
        discount: 0,
        discountType: 'fixed',
        whtRate: 5,
      },
    ];
    const totalDiscount = 1000;
    const result = calculateQuotationTotals(items, totalDiscount);

    // subtotal = 10000
    expect(result.subtotal).toBe(10000);
    // vat = (10000 - 1000) * 0.07 = 630
    expect(result.vatAmount).toBe(630);
    // wht = 10000 * 5/100 = 500
    expect(result.whtAmount).toBe(500);
    // grand = 10000 - 1000 + 630 - 500 = 9130
    expect(result.grandTotal).toBe(9130);
  });

  it('handles all WHT rates (0, 1, 2, 3, 5)', () => {
    const items: LineItemInput[] = [
      { quantity: 1, unitPrice: 1000, discount: 0, discountType: 'fixed', whtRate: 0 },
      { quantity: 1, unitPrice: 1000, discount: 0, discountType: 'fixed', whtRate: 1 },
      { quantity: 1, unitPrice: 1000, discount: 0, discountType: 'fixed', whtRate: 2 },
      { quantity: 1, unitPrice: 1000, discount: 0, discountType: 'fixed', whtRate: 3 },
      { quantity: 1, unitPrice: 1000, discount: 0, discountType: 'fixed', whtRate: 5 },
    ];
    const result = calculateQuotationTotals(items, 0);

    // subtotal = 5000
    expect(result.subtotal).toBe(5000);
    // wht = 0 + 10 + 20 + 30 + 50 = 110
    expect(result.whtAmount).toBe(110);
    // vat = 5000 * 0.07 = 350
    expect(result.vatAmount).toBe(350);
    // grand = 5000 + 350 - 110 = 5240
    expect(result.grandTotal).toBe(5240);
  });

  it('handles edge case: very small amounts', () => {
    const items: LineItemInput[] = [
      {
        quantity: 1,
        unitPrice: 0.01,
        discount: 0,
        discountType: 'fixed',
        whtRate: 3,
      },
    ];
    const result = calculateQuotationTotals(items, 0);

    expect(result.subtotal).toBe(0.01);
    expect(result.vatAmount).toBe(0);
    expect(result.whtAmount).toBe(0);
    expect(result.grandTotal).toBe(0.01);
  });

  it('handles percentage discount that equals full line amount', () => {
    const items: LineItemInput[] = [
      {
        quantity: 2,
        unitPrice: 500,
        discount: 100,
        discountType: 'percentage',
        whtRate: 3,
      },
    ];
    const result = calculateQuotationTotals(items, 0);

    // discount = 500 * 2 * 100/100 = 1000
    // line_total = 1000 - 1000 = 0
    expect(result.lineItems[0].lineTotal).toBe(0);
    expect(result.subtotal).toBe(0);
    expect(result.vatAmount).toBe(0);
    expect(result.whtAmount).toBe(0);
    expect(result.grandTotal).toBe(0);
  });

  it('ensures all results are 2 decimal places', () => {
    const items: LineItemInput[] = [
      {
        quantity: 3,
        unitPrice: 33.33,
        discount: 7,
        discountType: 'percentage',
        whtRate: 3,
      },
    ];
    const result = calculateQuotationTotals(items, 0);

    // Verify all values have at most 2 decimal places
    const check2dp = (n: number) => {
      const str = n.toString();
      const parts = str.split('.');
      if (parts.length === 2) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    };

    check2dp(result.subtotal);
    check2dp(result.vatAmount);
    check2dp(result.whtAmount);
    check2dp(result.grandTotal);
    result.lineItems.forEach((li) => {
      check2dp(li.discountAmount);
      check2dp(li.lineTotal);
    });
  });
});
