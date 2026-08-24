/**
 * Localization & Formatting Utilities for TANKHOR (تن‌خور)
 */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/**
 * Converts English digits in string or number to Persian digits
 */
export function toPersianDigits(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '';
  return String(num).replace(/\d/g, (digit) => PERSIAN_DIGITS[parseInt(digit, 10)]);
}

/**
 * Formats monetary amounts according to currency and active locale
 */
export function formatCurrency(amount: number | undefined | null, currency: string = 'TOMAN', isPersian: boolean = true): string {
  if (amount === undefined || amount === null) return '-';
  
  const formattedNumber = new Intl.NumberFormat('en-US').format(amount);
  const persianNumber = toPersianDigits(formattedNumber);

  if (isPersian) {
    if (currency === 'TOMAN' || currency === 'IRT') {
      return `${persianNumber} تومان`;
    }
    if (currency === 'IRR') {
      return `${persianNumber} ریال`;
    }
    return `$${persianNumber}`;
  }

  if (currency === 'TOMAN') return `${formattedNumber} Toman`;
  if (currency === 'IRR') return `${formattedNumber} IRR`;
  return `$${formattedNumber}`;
}

/**
 * Formats ISO date string to Persian Jalali format (or English date)
 */
export function formatDate(isoString?: string | null, isPersian: boolean = true): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;

    if (isPersian) {
      const formatted = new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
      return formatted;
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Safely extracts numeric ID from number, string, or object like { id: number }
 */
export function normalizeId(val: any): number | undefined {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (val && typeof val === 'object' && val !== null && 'id' in val) {
    const parsed = Number(val.id);
    return !isNaN(parsed) ? parsed : undefined;
  }
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    return !isNaN(parsed) ? parsed : undefined;
  }
  return undefined;
}

