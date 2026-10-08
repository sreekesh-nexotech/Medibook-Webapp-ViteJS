import { describe, expect, it } from 'vitest';

import type { Holiday } from '@/features/settings/domain/entities/profile.entities';
import {
  closedDaysWithin,
  upcomingClosures,
} from '@/features/settings/application/store/profile.form';
import { todayISO } from '@/shared/lib/format';
import { todayIn } from '@/shared/lib/hospitalTime';
import { HOSPITAL_DATE, HOSPITAL_TIME_ZONE, PC_DATE, withPcBehindHospital } from '@/test/pcClock';

const holiday = (from: string, to: string, departmentId: string | null = null): Holiday => ({
  id: `${from}-${to}`,
  name: 'Closure',
  from,
  to,
  departmentId,
  note: null,
  version: 1,
});

describe('closedDaysWithin (07·P-F3)', () => {
  it('counts overlapping closures once', () => {
    expect(
      closedDaysWithin(
        [holiday('2026-10-10', '2026-10-12'), holiday('2026-10-11', '2026-10-13')],
        '2026-10-01',
        '2026-10-31',
      ),
    ).toBe(4);
  });

  it('clips to the window', () => {
    expect(
      closedDaysWithin([holiday('2026-09-28', '2026-10-02')], '2026-10-01', '2026-10-31'),
    ).toBe(2);
  });

  it('is zero for nothing in the window', () => {
    expect(
      closedDaysWithin([holiday('2026-12-01', '2026-12-02')], '2026-10-01', '2026-10-31'),
    ).toBe(0);
  });
});

describe('upcomingClosures', () => {
  it('summarises the closures inside the window', () => {
    const summary = upcomingClosures(
      [
        holiday('2026-10-20', '2026-10-21'),
        holiday('2026-10-12', '2026-10-12', 'dept-1'),
        holiday('2027-02-01', '2027-02-01'),
      ],
      '2026-10-08',
      90,
    );
    expect(summary.upcoming).toHaveLength(2);
    expect(summary.closedDays).toBe(2);
    expect(summary.departmentClosures).toBe(1);
    expect(summary.next?.from).toBe('2026-10-12');
  });
});

describe('upcoming closures follow the hospital’s today (UAT-47)', () => {
  withPcBehindHospital();

  /** A closure that ended on the PC's date, and one on the hospital's. */
  const holidays = [holiday(PC_DATE, PC_DATE), holiday(HOSPITAL_DATE, HOSPITAL_DATE)];

  it('drops yesterday’s closure though the PC is still on that day', () => {
    expect(todayISO()).toBe(PC_DATE);
    const summary = upcomingClosures(holidays, todayIn(HOSPITAL_TIME_ZONE, Date.now()), 90);
    expect(summary.upcoming.map((h) => h.from)).toEqual([HOSPITAL_DATE]);
    expect(summary.next?.from).toBe(HOSPITAL_DATE);
    expect(summary.closedDays).toBe(1);
  });

  it('ends the window 90 days after the hospital’s today', () => {
    const today = todayIn(HOSPITAL_TIME_ZONE, Date.now());
    const edge = upcomingClosures([holiday('2027-01-06', '2027-01-06')], today, 90);
    expect(edge.upcoming).toHaveLength(1);
    const beyond = upcomingClosures([holiday('2027-01-07', '2027-01-07')], today, 90);
    expect(beyond.upcoming).toHaveLength(0);
  });
});
