import {
  gregorianToJalali,
  jalaliToGregorian,
  formatIsoDateString,
  getJalaliMonthDays,
  getTodayIso,
} from '../../../utils/dateUtils';

export type DatePresetKey =
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisSeason'
  | 'thisYear'
  | 'allTime'
  | 'custom';

export interface DateRangeResult {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export function calculateDateRange(preset: DatePresetKey, isPersian: boolean): DateRangeResult {
  const todayIso = getTodayIso();
  const now = new Date();

  if (preset === 'allTime') {
    return {
      from: '2020-01-01',
      to: todayIso,
    };
  }

  if (preset === 'today') {
    return {
      from: todayIso,
      to: todayIso,
    };
  }

  if (preset === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yIso = yesterday.toISOString().split('T')[0];
    return {
      from: yIso,
      to: yIso,
    };
  }

  if (preset === 'last7days') {
    const past7 = new Date(now);
    past7.setDate(now.getDate() - 6);
    return {
      from: past7.toISOString().split('T')[0],
      to: todayIso,
    };
  }

  if (preset === 'last30days') {
    const past30 = new Date(now);
    past30.setDate(now.getDate() - 29);
    return {
      from: past30.toISOString().split('T')[0],
      to: todayIso,
    };
  }

  if (isPersian) {
    // Jalali based ranges
    const jToday = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());

    if (preset === 'thisMonth') {
      const gStart = jalaliToGregorian(jToday.jy, jToday.jm, 1);
      const startIso = formatIsoDateString(gStart.gy, gStart.gm, gStart.gd);
      return {
        from: startIso,
        to: todayIso,
      };
    }

    if (preset === 'lastMonth') {
      let prevY = jToday.jy;
      let prevM = jToday.jm - 1;
      if (prevM < 1) {
        prevM = 12;
        prevY -= 1;
      }
      const daysInPrevM = getJalaliMonthDays(prevY, prevM);
      const gStart = jalaliToGregorian(prevY, prevM, 1);
      const gEnd = jalaliToGregorian(prevY, prevM, daysInPrevM);
      return {
        from: formatIsoDateString(gStart.gy, gStart.gm, gStart.gd),
        to: formatIsoDateString(gEnd.gy, gEnd.gm, gEnd.gd),
      };
    }

    if (preset === 'thisSeason') {
      // 1-3 Spring, 4-6 Summer, 7-9 Autumn, 10-12 Winter
      const seasonStartMonth = Math.floor((jToday.jm - 1) / 3) * 3 + 1;
      const gStart = jalaliToGregorian(jToday.jy, seasonStartMonth, 1);
      return {
        from: formatIsoDateString(gStart.gy, gStart.gm, gStart.gd),
        to: todayIso,
      };
    }

    if (preset === 'thisYear') {
      const gStart = jalaliToGregorian(jToday.jy, 1, 1);
      return {
        from: formatIsoDateString(gStart.gy, gStart.gm, gStart.gd),
        to: todayIso,
      };
    }
  } else {
    // Gregorian based ranges
    const gy = now.getFullYear();
    const gm = now.getMonth(); // 0-indexed

    if (preset === 'thisMonth') {
      const start = new Date(gy, gm, 1);
      return {
        from: start.toISOString().split('T')[0],
        to: todayIso,
      };
    }

    if (preset === 'lastMonth') {
      const start = new Date(gy, gm - 1, 1);
      const end = new Date(gy, gm, 0);
      return {
        from: start.toISOString().split('T')[0],
        to: end.toISOString().split('T')[0],
      };
    }

    if (preset === 'thisSeason') {
      const quarterStartMonth = Math.floor(gm / 3) * 3;
      const start = new Date(gy, quarterStartMonth, 1);
      return {
        from: start.toISOString().split('T')[0],
        to: todayIso,
      };
    }

    if (preset === 'thisYear') {
      const start = new Date(gy, 0, 1);
      return {
        from: start.toISOString().split('T')[0],
        to: todayIso,
      };
    }
  }

  return {
    from: todayIso,
    to: todayIso,
  };
}
