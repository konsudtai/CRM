/**
 * Thai Baht currency formatting utilities.
 * Uses ฿ symbol, comma thousands separator, period for decimals, 2 decimal places.
 */

/**
 * Formats a number as Thai Baht.
 * E.g. formatBaht(1234567.89) → "฿1,234,567.89"
 */
export function formatBaht(amount: number): string {
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  const isNegative = intPart.startsWith('-');
  const digits = isNegative ? intPart.slice(1) : intPart;

  // Add comma thousands separators
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `฿${isNegative ? '-' : ''}${withCommas}.${decPart}`;
}

/**
 * Parses a formatted Thai Baht string back to a number.
 * E.g. parseBaht("฿1,234,567.89") → 1234567.89
 */
export function parseBaht(formatted: string): number {
  // Strip ฿ symbol, commas, and whitespace
  const cleaned = formatted.replace(/[฿,\s]/g, '');
  const value = parseFloat(cleaned);

  if (isNaN(value)) {
    throw new Error(`Invalid Thai Baht format: "${formatted}"`);
  }

  return value;
}
