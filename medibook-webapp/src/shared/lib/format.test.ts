import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addDaysISO,
  daysFromTodayISO,
  fmtDate,
  formatToken,
  isPastISO,
  isoToRel,
  money,
  moneyShort,
  parseHundredths,
  relToISO,
  timeToMinutes,
  toLocalISO,
  todayISO,
} from '@/shared/lib/format';

describe('money', () => {
  it('groups rupees the Indian way', () => {
    expect(money(1234567)).toBe('₹ 12,34,567');
    expect(money(0)).toBe('₹ 0');
  });

  it('shows a dash when there is no amount', () => {
    expect(money(null)).toBe('—');
    expect(money(undefined)).toBe('—');
  });
});

describe('moneyShort', () => {
  it('abbreviates lakhs and thousands for KPI tiles', () => {
    expect(moneyShort(260000)).toBe('₹ 2.6L');
    expect(moneyShort(100000)).toBe('₹ 1L');
    expect(moneyShort(9800)).toBe('₹ 9.8K');
    expect(moneyShort(5000)).toBe('₹ 5K');
    expect(moneyShort(999)).toBe('₹ 999');
  });
});

describe('fmtDate', () => {
  it('formats an ISO date as day, short month and year', () => {
    expect(fmtDate('2026-06-20')).toBe('20 Jun 2026');
    expect(fmtDate('2026-09-01')).toBe('01 Sep 2026');
  });

  it('shows a dash when there is no date', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate('')).toBe('—');
  });
});

describe('toLocalISO', () => {
  it('runs in IST, where 00:30 is still the previous day in UTC', () => {
    // Precondition for the next test: vitest.config.ts pins TZ to Asia/Kolkata.
    expect(new Date(2026, 9, 6, 0, 30).toISOString()).toBe('2026-10-05T19:00:00.000Z');
  });

  it('keeps the local calendar day just after midnight in IST', () => {
    // 00:30 IST is still the previous day in UTC; toISOString() would say 5 Oct.
    expect(toLocalISO(new Date(2026, 9, 6, 0, 30))).toBe('2026-10-06');
  });
});

describe('addDaysISO', () => {
  it('moves across month and year ends', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('dates relative to today', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 6, 0, 15));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads today from the local calendar, not UTC', () => {
    expect(todayISO()).toBe('2026-10-06');
  });

  it('counts whole days from today', () => {
    expect(daysFromTodayISO('2026-10-06')).toBe(0);
    expect(daysFromTodayISO('2026-10-08')).toBe(2);
    expect(daysFromTodayISO('2026-10-01')).toBe(-5);
    expect(isPastISO('2026-10-05')).toBe(true);
    expect(isPastISO('2026-10-06')).toBe(false);
  });

  it('labels dates the way the screens show them', () => {
    expect(isoToRel('2026-10-06')).toBe('Today');
    expect(isoToRel('2026-10-07')).toBe('Tomorrow');
    expect(isoToRel('2026-10-14')).toBe('14 Oct');
  });

  it('reads labels back into ISO dates', () => {
    expect(relToISO('Today')).toBe('2026-10-06');
    expect(relToISO('Tomorrow')).toBe('2026-10-07');
    expect(relToISO('14 Jun 2025')).toBe('2025-06-14');
    expect(relToISO('2026-11-01')).toBe('2026-11-01');
  });

  it('rolls a day-month label more than six months back into next year', () => {
    expect(relToISO('14 Jun')).toBe('2026-06-14');
    expect(relToISO('2 Jan')).toBe('2027-01-02');
  });

  it('falls back to today for a label it cannot read', () => {
    expect(relToISO('next week')).toBe('2026-10-06');
  });
});

describe('timeToMinutes', () => {
  it('converts clock times to minutes since midnight', () => {
    expect(timeToMinutes('8:30 am')).toBe(510);
    expect(timeToMinutes('12:15 pm')).toBe(735);
    expect(timeToMinutes('12:05 am')).toBe(5);
    expect(timeToMinutes('7:45 PM')).toBe(1185);
  });

  it('treats a missing time as midnight', () => {
    expect(timeToMinutes(null)).toBe(0);
    expect(timeToMinutes('soon')).toBe(0);
  });
});

describe('formatToken', () => {
  it('pads the running token to three digits', () => {
    expect(formatToken(7)).toBe('T-007');
    expect(formatToken(1234)).toBe('T-1234');
  });
});

describe('parseHundredths', () => {
  it('reads rupees as paise without floating-point rounding', () => {
    expect(parseHundredths('500')).toBe(50000);
    expect(parseHundredths('500.5')).toBe(50050);
    expect(parseHundredths('1,250.75')).toBe(125075);
    expect(parseHundredths('0.1')).toBe(10);
    expect(parseHundredths(' 42 ')).toBe(4200);
    expect(parseHundredths('0')).toBe(0);
  });

  it('refuses anything that is not a plain amount with up to two decimals', () => {
    expect(parseHundredths('')).toBeNull();
    expect(parseHundredths('abc')).toBeNull();
    expect(parseHundredths('-5')).toBeNull();
    expect(parseHundredths('.5')).toBeNull();
    expect(parseHundredths('12.345')).toBeNull();
    expect(parseHundredths('1234567890')).toBeNull();
  });
});
