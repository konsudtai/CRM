/**
 * Buddhist Era date conversion utilities.
 * Thai year (พ.ศ.) = Gregorian year (ค.ศ.) + 543
 */

const BUDDHIST_ERA_OFFSET = 543;

export interface ThaiDateOptions {
  /** Use Buddhist Era (พ.ศ.) or Gregorian (ค.ศ.). Defaults to 'buddhist'. */
  era?: 'buddhist' | 'gregorian';
}

/**
 * Converts a Gregorian Date to a Thai-formatted date string.
 * Default output uses Buddhist Era (พ.ศ.): DD/MM/YYYY+543
 */
export function toThaiDate(date: Date, options?: ThaiDateOptions): string {
  const era = options?.era ?? 'buddhist';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year =
    era === 'buddhist'
      ? date.getFullYear() + BUDDHIST_ERA_OFFSET
      : date.getFullYear();

  return `${day}/${month}/${year}`;
}

/**
 * Parses a Thai date string (DD/MM/YYYY) back to a Gregorian Date.
 * If the year >= 2400 it is assumed to be Buddhist Era and converted back.
 */
export function fromThaiDate(thaiDateStr: string): Date {
  const parts = thaiDateStr.split('/');
  if (parts.length !== 3) {
    throw new Error(`Invalid Thai date format: "${thaiDateStr}". Expected DD/MM/YYYY`);
  }

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  let year = parseInt(parts[2], 10);

  if (isNaN(day) || isNaN(month) || isNaN(year)) {
    throw new Error(`Invalid Thai date format: "${thaiDateStr}". Non-numeric components`);
  }

  // Buddhist Era years are >= 2400 (since current Gregorian ~2025 → ~2568 BE)
  if (year >= 2400) {
    year -= BUDDHIST_ERA_OFFSET;
  }

  const date = new Date(year, month - 1, day);
  // Handle years 0-99 which Date constructor treats as 1900-1999
  date.setFullYear(year);
  return date;
}

/**
 * Formats a Date using Intl.DateTimeFormat with Thai locale.
 * Wraps Intl.DateTimeFormat for consistent Thai formatting.
 */
export function formatThaiDateIntl(
  date: Date,
  options?: Intl.DateTimeFormatOptions,
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    calendar: 'buddhist',
  };
  const formatter = new Intl.DateTimeFormat('th-TH', {
    ...defaultOptions,
    ...options,
  });
  return formatter.format(date);
}
