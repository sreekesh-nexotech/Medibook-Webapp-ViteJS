import { describe, expect, it } from 'vitest';

import {
  scheduleResponseSchema,
  toSchedule,
  toWallClockHhmm,
} from '@/features/doctors/infrastructure/data-sources/remote/doctors.response';

describe('toWallClockHhmm (UAT-19)', () => {
  it('reads plain DRF times', () => {
    expect(toWallClockHhmm('09:00:00')).toBe('09:00');
    expect(toWallClockHhmm('17:30')).toBe('17:30');
  });

  it('reads the clock part of a date-time as written (hospital offset), not via the browser zone', () => {
    expect(toWallClockHhmm('2026-10-07T09:00:00+05:30')).toBe('09:00');
    expect(toWallClockHhmm('2026-10-07T21:15:00-04:00')).toBe('21:15');
  });

  it('returns null for anything else', () => {
    expect(toWallClockHhmm('')).toBeNull();
    expect(toWallClockHhmm('2026-')).toBeNull();
    expect(toWallClockHhmm(null)).toBeNull();
  });
});

describe('resolved next-14-days sessions', () => {
  const base = {
    doctor_id: 'd1',
    version: 3,
    slot_length_min: 15,
    weekly_sessions: [],
    leaves: [],
    date_exceptions: [],
  };

  it('turns ISO date-times into HH:MM instead of "2026-"', () => {
    const dto = scheduleResponseSchema.parse({
      ...base,
      resolved: [
        {
          date: '2026-10-07',
          source: 'weekly',
          sessions: [
            {
              session_code: 'morning',
              label: 'Morning',
              starts_at: '2026-10-07T09:00:00+05:30',
              ends_at: '2026-10-07T13:00:00+05:30',
            },
          ],
        },
      ],
    });
    expect(toSchedule(dto).upcoming[0]?.sessions[0]).toMatchObject({
      startsAt: '09:00',
      endsAt: '13:00',
    });
  });

  it('prefers the backend’s own HH:MM when it sends start_time/end_time', () => {
    const dto = scheduleResponseSchema.parse({
      ...base,
      resolved: [
        {
          date: '2026-10-07',
          source: 'weekly',
          sessions: [
            {
              session_code: 'evening',
              label: 'Evening',
              starts_at: '2026-10-07T12:30:00Z',
              ends_at: '2026-10-07T14:30:00Z',
              start_time: '18:00',
              end_time: '20:00',
            },
          ],
        },
      ],
    });
    expect(toSchedule(dto).upcoming[0]?.sessions[0]).toMatchObject({
      startsAt: '18:00',
      endsAt: '20:00',
    });
  });
});
