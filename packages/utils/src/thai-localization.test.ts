import { toThaiDate, fromThaiDate, formatBaht, parseBaht, formatThaiAddress } from './index';

describe('toThaiDate / fromThaiDate', () => {
  it('converts a Gregorian date to Buddhist Era and back', () => {
    const date = new Date(2025, 0, 15); // Jan 15, 2025
    const thai = toThaiDate(date);
    expect(thai).toBe('15/01/2568');

    const back = fromThaiDate(thai);
    expect(back.getFullYear()).toBe(2025);
    expect(back.getMonth()).toBe(0);
    expect(back.getDate()).toBe(15);
  });

  it('supports Gregorian era option', () => {
    const date = new Date(2025, 5, 1);
    expect(toThaiDate(date, { era: 'gregorian' })).toBe('01/06/2025');
  });

  it('throws on invalid format', () => {
    expect(() => fromThaiDate('invalid')).toThrow();
  });
});

describe('formatBaht / parseBaht', () => {
  it('formats a number as Thai Baht', () => {
    expect(formatBaht(1234567.89)).toBe('฿1,234,567.89');
  });

  it('formats zero', () => {
    expect(formatBaht(0)).toBe('฿0.00');
  });

  it('formats small amounts', () => {
    expect(formatBaht(0.5)).toBe('฿0.50');
  });

  it('parses formatted Baht back to number', () => {
    expect(parseBaht('฿1,234,567.89')).toBe(1234567.89);
  });

  it('round-trips correctly', () => {
    const original = 99999.99;
    expect(parseBaht(formatBaht(original))).toBe(original);
  });

  it('throws on invalid input', () => {
    expect(() => parseBaht('not-a-number')).toThrow();
  });
});

describe('formatThaiAddress', () => {
  it('formats a full address in correct Thai order', () => {
    const result = formatThaiAddress({
      street: '123 ถนนสุขุมวิท',
      subDistrict: 'คลองเตย',
      district: 'คลองเตย',
      province: 'กรุงเทพมหานคร',
      postalCode: '10110',
    });
    expect(result).toBe('123 ถนนสุขุมวิท คลองเตย คลองเตย กรุงเทพมหานคร 10110');
  });

  it('skips empty components', () => {
    const result = formatThaiAddress({
      province: 'เชียงใหม่',
      postalCode: '50000',
    });
    expect(result).toBe('เชียงใหม่ 50000');
  });

  it('returns empty string for empty address', () => {
    expect(formatThaiAddress({})).toBe('');
  });
});
