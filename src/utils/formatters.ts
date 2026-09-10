/**
 * Localization & Formatting Utilities for TANKHOR (تن‌خور)
 */

import { isoToJalali, PERSIAN_MONTH_NAMES } from './dateUtils';

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function isCurrentLocalePersian(): boolean {
  if (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang) {
    return document.documentElement.lang === 'fa';
  }
  return true;
}

/**
 * Converts English digits in string or number to Persian digits if Persian locale is active
 */
export function toPersianDigits(num: number | string | undefined | null, force: boolean = false): string {
  if (num === undefined || num === null) return '';
  if (!force && !isCurrentLocalePersian()) {
    return String(num);
  }
  return String(num).replace(/\d/g, (digit) => PERSIAN_DIGITS[parseInt(digit, 10)]);
}

/**
 * Formats monetary amounts according to currency and active locale
 */
export function formatCurrency(
  amount: number | undefined | null,
  currency: string = 'TOMAN',
  isPersian?: boolean
): string {
  if (amount === undefined || amount === null) return '-';

  const persianMode = isPersian !== undefined ? isPersian : isCurrentLocalePersian();
  const formattedNumber = new Intl.NumberFormat('en-US').format(amount);

  if (persianMode) {
    const persianNumber = toPersianDigits(formattedNumber, true);
    if (currency === 'TOMAN' || currency === 'IRT') {
      return `${persianNumber} تومان`;
    }
    if (currency === 'IRR') {
      return `${persianNumber} ریال`;
    }
    if (currency === 'USD') {
      return `$${persianNumber}`;
    }
    if (currency === 'EUR') {
      return `€${persianNumber}`;
    }
    return `${persianNumber} ${currency}`;
  }

  if (currency === 'TOMAN') return `${formattedNumber} Toman`;
  if (currency === 'IRR') return `${formattedNumber} IRR`;
  if (currency === 'USD') return `$${formattedNumber}`;
  if (currency === 'EUR') return `€${formattedNumber}`;
  return `${formattedNumber} ${currency}`;
}

/**
 * Formats ISO date string to Persian Jalali format (or English Gregorian date)
 */
export function formatDate(isoString?: string | null, isPersian?: boolean): string {
  if (!isoString) return '-';
  try {
    const persianMode = isPersian !== undefined ? isPersian : isCurrentLocalePersian();

    // Check if it's pure YYYY-MM-DD
    let date: Date;
    const clean = String(isoString).trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [gy, gm, gd] = clean.split('-').map(Number);
      date = new Date(gy, gm - 1, gd, 12, 0, 0);
    } else {
      date = new Date(isoString);
    }

    if (isNaN(date.getTime())) return String(isoString);

    if (persianMode) {
      const j = isoToJalali(clean);
      const monthName = PERSIAN_MONTH_NAMES[j.jm - 1] || '';
      return `${toPersianDigits(j.jd, true)} ${monthName} ${toPersianDigits(j.jy, true)}`;
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return String(isoString);
  }
}

export const formatPersianDate = formatDate;

/**
 * Formats ISO date string to numeric format:
 * Persian: ۱۴۰۵/۰۶/۱۹ (or 1405/06/19)
 * English: 2026-09-10
 */
export function formatDateNumeric(isoString?: string | null, isPersian?: boolean): string {
  if (!isoString) return '-';
  try {
    const persianMode = isPersian !== undefined ? isPersian : isCurrentLocalePersian();
    const clean = String(isoString).trim().slice(0, 10);

    if (persianMode) {
      const j = isoToJalali(clean);
      const m = String(j.jm).padStart(2, '0');
      const d = String(j.jd).padStart(2, '0');
      return toPersianDigits(`${j.jy}/${m}/${d}`, true);
    }

    return clean;
  } catch {
    return String(isoString);
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
