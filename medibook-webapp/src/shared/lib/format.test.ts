import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  addDaysISO,
  calendarInstant,
  calendarDate,
  calendarTimeHm,
  calendarTimeZone,
  daysFromTodayISO,
  DEFAULT_CALENDAR_ZONE,
  fmtDate,
  isoToRel,
  isPastISO,
  minutesOfDay,
  money,
  rupeesFromPaise,
  rupeesFixed,
  moneyFromPaise,
  moneyShort,
  parseHundredths,
  phoneDisplay,
  relToISO,
  setCalendarZone,
  timeToMinutes,
  todayISO,
  toLocalISO,
} from '@/shared/lib/format';

describe('money', () => {
  it('groups rupees the Indian way', () => {
    expect(money(1234567)).toBe('₹ 12,34,567.00');
    expect(money(0)).toBe('₹ 0.00');
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

describe('hospital calendar (DATA-01, DATA-02)', () => {
  afterEach(() => {
    setCalendarZone(null);
    vi.useRealTimers();
  });

  it('dates an invoice issued at 00:30 IST on its Indian day, not the UTC one', () => {
    expect(calendarDate('2026-10-02T19:00:01Z')).toBe('2026-10-03');
  });

  it("follows the hospital's zone, and falls back to IST for an unknown one", () => {
    setCalendarZone('Pacific/Kiritimati');
    expect(calendarDate('2026-10-06T11:00:00Z')).toBe('2026-10-07');
    setCalendarZone('Not/AZone');
    expect(calendarTimeZone()).toBe(DEFAULT_CALENDAR_ZONE);
  });

  it('takes today from the hospital calendar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T20:30:00Z'));
    expect(todayISO()).toBe('2026-10-07');
    expect(daysFromTodayISO('2026-10-06')).toBe(-1);
    expect(isoToRel('2026-10-08')).toBe('Tomorrow');
  });

  it("shows times on the hospital's clock", () => {
    expect(calendarTimeHm('2026-10-06T20:30:00Z')).toBe('02:00');
    expect(minutesOfDay('2026-10-06T20:30:00Z')).toBe(120);
  });

  it('adds days across month and year ends', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('calendarInstant (DATA-03)', () => {
  afterEach(() => setCalendarZone(null));

  it("builds the hospital's midnight with its offset, whatever the device zone", () => {
    expect(calendarInstant('2026-10-06')).toBe('2026-10-06T00:00:00+05:30');
    expect(calendarInstant('2026-10-06', '23:59:59')).toBe('2026-10-06T23:59:59+05:30');
    expect(calendarDate(calendarInstant('2026-10-06', '12:00:00'))).toBe('2026-10-06');
  });

  it('uses +00:00 for a hospital on UTC', () => {
    setCalendarZone('UTC');
    expect(calendarInstant('2026-10-06')).toBe('2026-10-06T00:00:00+00:00');
  });
});

describe('money always shows two decimals from integer paise (DATA-06)', () => {
  it('pads, rounds to the paisa and keeps the sign', () => {
    expect(money(90.5)).toBe('₹ 90.50');
    expect(money(0.1 + 0.2)).toBe('₹ 0.30');
    expect(money(-500)).toBe('₹ -500.00');
    expect(moneyFromPaise(10240050)).toBe('₹ 1,02,400.50');
  });

  it('writes export figures without grouping or symbol', () => {
    expect(rupeesFromPaise(9050)).toBe('90.50');
    expect(rupeesFromPaise(-5)).toBe('-0.05');
    expect(rupeesFixed(124.875)).toBe('124.88');
  });
});

describe('phoneDisplay', () => {
  it('groups an Indian mobile number 5 + 5', () => {
    expect(phoneDisplay('+919876543210')).toBe('+91 98765 43210');
  });

  it('groups an Indian landline 3 + 3 + 4', () => {
    expect(phoneDisplay('+914847100000')).toBe('+91 484 710 0000');
  });

  it('shows anything else as stored', () => {
    expect(phoneDisplay('+441632960961')).toBe('+441632960961');
    expect(phoneDisplay('+9118002004567')).toBe('+9118002004567');
  });
});
