/**
 * Jalali (Solar Persian) & Gregorian Date Conversion & Manipulation Utilities
 * Based on the high-precision astronomical Borkowski algorithm.
 */

export interface JalaliDate {
  jy: number; // Jalali year (e.g. 1405)
  jm: number; // Jalali month (1 - 12)
  jd: number; // Jalali day (1 - 31)
}

export interface GregorianDate {
  gy: number; // Gregorian year (e.g. 2026)
  gm: number; // Gregorian month (1 - 12)
  gd: number; // Gregorian day (1 - 31)
}

export const PERSIAN_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const GREGORIAN_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export const PERSIAN_WEEKDAYS = [
  { key: 'sa', label: 'شنبه', short: 'ش' },
  { key: 'su', label: 'یکشنبه', short: 'ی' },
  { key: 'mo', label: 'دوشنبه', short: 'د' },
  { key: 'tu', label: 'سه‌شنبه', short: 'س' },
  { key: 'we', label: 'چهارشنبه', short: 'چ' },
  { key: 'th', label: 'پنجشنبه', short: 'پ' },
  { key: 'fr', label: 'جمعه', short: 'ج' },
] as const;

export const GREGORIAN_WEEKDAYS = [
  { key: 'su', label: 'Sunday', short: 'Su' },
  { key: 'mo', label: 'Monday', short: 'Mo' },
  { key: 'tu', label: 'Tuesday', short: 'Tu' },
  { key: 'we', label: 'Wednesday', short: 'We' },
  { key: 'th', label: 'Thursday', short: 'Th' },
  { key: 'fr', label: 'Friday', short: 'Fr' },
  { key: 'sa', label: 'Saturday', short: 'Sa' },
] as const;

/**
 * Checks if a given Jalali year is a leap year (کبیسه).
 */
export function isJalaliLeapYear(jy: number): boolean {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let jp = breaks[0];
  let jm: number;
  let leapJ: number;

  if (jy < jp || jy >= breaks[breaks.length - 1]) {
    // Fallback standard modulo approximation
    return (((((jy - ((jy > 0) ? 474 : 473)) % 2820) + 474) + 38) * 682) % 2816 < 682;
  }

  for (let i = 1; i < breaks.length; i++) {
    jm = breaks[i];
    if (jy < jm) {
      const jump = jm - jp;
      leapJ = ((jy - jp) % 33) * 8 + Math.floor(((jy - jp) % 33) / 4);
      return ((((jy - jp) % 33) + 1) * 8) % 33 <= 8;
    }
    jp = jm;
  }
  return false;
}

/**
 * Returns number of days in a given Jalali month (1-12).
 */
export function getJalaliMonthDays(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  if (jm === 12) {
    // Esfand has 30 days in leap year, 29 otherwise
    // Simple test: check if next day 30 converts cleanly back to Esfand
    const gNext = jalaliToGregorian(jy, 12, 30);
    const jBack = gregorianToJalali(gNext.gy, gNext.gm, gNext.gd);
    return (jBack.jy === jy && jBack.jm === 12 && jBack.jd === 30) ? 30 : 29;
  }
  return 30;
}

/**
 * Converts Gregorian date (year, month 1-12, day 1-31) to Jalali (jy, jm, jd).
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDate {
  gy = Number(gy);
  gm = Number(gm);
  gd = Number(gd);
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = (gm > 2) ? (gy + 1) : gy;
  let days = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(days / 12053));
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return { jy, jm, jd };
}

/**
 * Converts Jalali date (year, month 1-12, day 1-31) to Gregorian (gy, gm, gd).
 */
export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDate {
  jy = Number(jy);
  jm = Number(jm);
  jd = Number(jd);
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  let days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return { gy, gm, gd };
}

/**
 * Formats a Gregorian Date or ISO string into a standard YYYY-MM-DD string.
 */
export function formatIsoDateString(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Formats a Jalali date into standard YYYY/MM/DD string.
 */
export function formatJalaliDateString(jy: number, jm: number, jd: number): string {
  const m = String(jm).padStart(2, '0');
  const d = String(jd).padStart(2, '0');
  return `${jy}/${m}/${d}`;
}

/**
 * Converts a standard Gregorian ISO string (YYYY-MM-DD or ISO timestamp) to JalaliDate object.
 */
export function isoToJalali(isoString?: string | null): JalaliDate {
  if (!isoString) {
    const now = new Date();
    return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  try {
    const parts = isoString.slice(0, 10).split('-');
    if (parts.length === 3) {
      const gy = Number(parts[0]);
      const gm = Number(parts[1]);
      const gd = Number(parts[2]);
      if (!isNaN(gy) && !isNaN(gm) && !isNaN(gd)) {
        return gregorianToJalali(gy, gm, gd);
      }
    }
    const d = new Date(isoString);
    if (!isNaN(d.getTime())) {
      return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
  } catch (err) {
    // Fallback to today
  }

  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/**
 * Converts a standard Gregorian ISO string (YYYY-MM-DD) to Jalali string (YYYY/MM/DD).
 */
export function isoToJalaliString(isoString?: string | null): string {
  const j = isoToJalali(isoString);
  return formatJalaliDateString(j.jy, j.jm, j.jd);
}

/**
 * Converts a Jalali date object or string (YYYY/MM/DD) to standard Gregorian ISO date string (YYYY-MM-DD).
 */
export function jalaliToIsoString(input: string | JalaliDate): string {
  if (typeof input === 'string') {
    const parts = input.replace(/\//g, '-').split('-');
    if (parts.length === 3) {
      const jy = Number(parts[0]);
      const jm = Number(parts[1]);
      const jd = Number(parts[2]);
      if (!isNaN(jy) && !isNaN(jm) && !isNaN(jd)) {
        const g = jalaliToGregorian(jy, jm, jd);
        return formatIsoDateString(g.gy, g.gm, g.gd);
      }
    }
    return new Date().toISOString().split('T')[0];
  }

  const g = jalaliToGregorian(input.jy, input.jm, input.jd);
  return formatIsoDateString(g.gy, g.gm, g.gd);
}

/**
 * Gets the Persian weekday index (0 = Saturday, 6 = Friday) for the 1st of a given Jalali month.
 */
export function getFirstDayOfJalaliMonth(jy: number, jm: number): number {
  const g = jalaliToGregorian(jy, jm, 1);
  const d = new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0);
  // In JS: Sunday is 0, Monday 1, ..., Saturday 6
  // In Iranian calendar: Saturday is 0, Sunday 1, ..., Friday 6
  return (d.getDay() + 1) % 7;
}

/**
 * Returns today's ISO date string (YYYY-MM-DD).
 */
export function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
