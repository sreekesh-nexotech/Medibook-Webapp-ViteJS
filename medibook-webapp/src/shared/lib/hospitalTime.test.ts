import { describe, expect, it } from 'vitest';

import {
  addIsoDays,
  DEFAULT_HOSPITAL_TIME_ZONE,
  formatDateTimeIn,
  formatDayIn,
  formatTimeIn,
  formatWeekdayDayIn,
  isInstantOver,
  isoDayIn,
  isoDaysBetween,
  minutesOfDayIn,
  safeTimeZone,
  todayIn,
} from '@/shared/lib/hospitalTime';

const KOLKATA = 'Asia/Kolkata';
const DUBAI = 'Asia/Dubai';
const NEW_YORK = 'America/New_York';

/** 7 Oct 2026, 20:00 UTC = 8 Oct 01:30 in Kolkata = 7 Oct 16:00 in New York. */
const LATE_UTC = Date.UTC(2026, 9, 7, 20, 0);

describe('hospital-local today (UAT-47)', () => {
  it('uses the hospital zone, not the PC zone', () => {
    // The test runner itself runs in IST; a New York hospital is still on the 7th.
    expect(todayIn(KOLKATA, LATE_UTC)).toBe('2026-10-08');
    expect(todayIn(NEW_YORK, LATE_UTC)).toBe('2026-10-07');
    expect(todayIn(DUBAI, LATE_UTC)).toBe('2026-10-08');
  });

  it('reads the day of an instant in the zone', () => {
    expect(isoDayIn('2026-10-07T20:00:00Z', KOLKATA)).toBe('2026-10-08');
    expect(isoDayIn('not a date', KOLKATA)).toBe('');
  });

  it('falls back to the backend default for an unknown or missing zone', () => {
    expect(safeTimeZone(null)).toBe(DEFAULT_HOSPITAL_TIME_ZONE);
    expect(safeTimeZone('Mars/Olympus_Mons')).toBe(DEFAULT_HOSPITAL_TIME_ZONE);
    expect(safeTimeZone(DUBAI)).toBe(DUBAI);
    expect(todayIn('Mars/Olympus_Mons', LATE_UTC)).toBe('2026-10-08');
  });
});

describe('calendar arithmetic', () => {
  it('shifts days across month and year ends', () => {
    expect(addIsoDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addIsoDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addIsoDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addIsoDays('bad', 3)).toBe('bad');
  });

  it('counts days between two dates', () => {
    expect(isoDaysBetween('2026-10-07', '2026-10-14')).toBe(7);
    expect(isoDaysBetween('2026-10-07', '2026-10-01')).toBe(-6);
  });
});

describe('display in the hospital zone', () => {
  const instant = '2026-10-07T04:00:00Z'; // 9:30 am in Kolkata, 8:00 am in Dubai

  it('formats clock times in the zone', () => {
    expect(formatTimeIn(instant, KOLKATA)).toMatch(/^9:30\s?am$/i);
    expect(formatTimeIn(instant, DUBAI)).toMatch(/^8:00\s?am$/i);
    expect(formatTimeIn(null, KOLKATA)).toBe('—');
  });

  it('never shifts a plain calendar day', () => {
    expect(formatDayIn('2026-10-07', NEW_YORK)).toBe('7 Oct');
    expect(formatDayIn('2026-10-07T20:00:00Z', KOLKATA)).toBe('8 Oct');
    expect(formatWeekdayDayIn('2026-10-07', KOLKATA)).toMatch(/Wed/);
  });

  it('formats a date and time together', () => {
    expect(formatDateTimeIn(instant, KOLKATA)).toMatch(/7 Oct 2026.*9:30/);
    expect(formatDateTimeIn('', KOLKATA)).toBe('—');
  });

  it('gives minutes past midnight on the hospital clock', () => {
    expect(minutesOfDayIn(instant, KOLKATA)).toBe(9 * 60 + 30);
    expect(minutesOfDayIn('2026-10-07T18:30:00Z', KOLKATA)).toBe(0);
    expect(minutesOfDayIn(undefined, KOLKATA)).toBeNull();
  });

  it('tells whether an instant has been reached', () => {
    const now = Date.parse(instant);
    expect(isInstantOver(instant, now)).toBe(true);
    expect(isInstantOver('2026-10-07T04:15:00Z', now)).toBe(false);
    expect(isInstantOver(null, now)).toBe(false);
  });
});
