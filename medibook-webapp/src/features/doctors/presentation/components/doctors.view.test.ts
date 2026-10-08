import { describe, expect, it } from 'vitest';

import type {
  DoctorScheduleHistory,
  WeeklySession,
} from '@/features/doctors/domain/entities/doctors.types';
import {
  gridToSessions,
  pastScheduleLines,
  sameSessions,
  sessionsToGrid,
} from '@/features/doctors/presentation/components/doctors.view';
import { todayIn } from '@/shared/lib/hospitalTime';
import { todayISO } from '@/shared/lib/format';
import { HOSPITAL_DATE, HOSPITAL_TIME_ZONE, PC_DATE, withPcBehindHospital } from '@/test/pcClock';

/** The seeded shape on the test backend: "Morning OPD" daily, "Evening OPD" Mon/Wed/Fri. */
const morning = (weekday: number): WeeklySession => ({
  weekday,
  sessionCode: 'morning',
  label: 'Morning OPD',
  startsAt: '09:00',
  endsAt: '12:00',
});
const evening = (weekday: number): WeeklySession => ({
  weekday,
  sessionCode: 'evening',
  label: 'Evening OPD',
  startsAt: '17:00',
  endsAt: '19:00',
});
const SEEDED: readonly WeeklySession[] = [
  morning(0),
  evening(0),
  morning(1),
  morning(2),
  evening(2),
  morning(3),
  morning(4),
  evening(4),
  morning(5),
];

const codesOf = (sessions: readonly WeeklySession[]): string[] =>
  sessions.map((s) => `${s.weekday}:${s.sessionCode}`).sort();

describe('weekly sessions ↔ editor grid', () => {
  it('round-trips the seeded schedule with its own session codes', () => {
    const out = gridToSessions(sessionsToGrid(SEEDED));
    expect(sameSessions(out, SEEDED)).toBe(true);
    expect(codesOf(out)).toEqual(codesOf(SEEDED));
  });

  it('keeps the code when a pattern’s hours change', () => {
    const grid = sessionsToGrid(SEEDED);
    const edited = {
      ...grid,
      patterns: grid.patterns.map((p) => (p.name === 'Morning OPD' ? { ...p, to: '1:00 pm' } : p)),
    };
    const out = gridToSessions(edited);
    expect(codesOf(out)).toEqual(codesOf(SEEDED));
    expect(out.find((s) => s.weekday === 0 && s.sessionCode === 'morning')?.endsAt).toBe('13:00');
  });

  it('gives a pattern newly assigned to a day its own code, never a duplicate', () => {
    const grid = sessionsToGrid(SEEDED);
    const eveningId = grid.patterns.find((p) => p.name === 'Evening OPD')?.id ?? '';
    const tuesday = grid.week[1];
    const out = gridToSessions({
      ...grid,
      week: grid.week.map((d, i) =>
        i === 1 ? { ...tuesday, patternIds: [...(tuesday.patternIds ?? []), eveningId] } : d,
      ),
    });
    expect(out.filter((s) => s.weekday === 1).map((s) => s.sessionCode)).toEqual([
      'morning',
      'evening',
    ]);
  });

  it('adds a new pattern under the first free custom code', () => {
    const grid = sessionsToGrid([morning(0)]);
    const out = gridToSessions({
      ...grid,
      patterns: [
        ...grid.patterns,
        { id: 'draft-1', name: 'Lunch clinic', from: '1:00 pm', to: '2:00 pm' },
      ],
      week: grid.week.map((d, i) =>
        i === 0 ? { ...d, patternIds: [...(d.patternIds ?? []), 'draft-1'] } : d,
      ),
    });
    expect(out.map((s) => s.sessionCode).sort()).toEqual(['custom-1', 'morning']);
  });
});

describe('past leave and exceptions split on the hospital’s today (UAT-47, 06·Profile F9)', () => {
  withPcBehindHospital();

  /** Leave that ended on the PC's date, and an exception on the hospital's date. */
  const history: DoctorScheduleHistory = {
    leaves: [
      {
        id: 'l-1',
        kind: 'sick',
        dateFrom: '2026-10-05',
        dateTo: PC_DATE,
        reason: 'Fever',
        version: 1,
      },
    ],
    dateExceptions: [
      { id: 'e-1', date: HOSPITAL_DATE, kind: 'closed', note: '', sessions: [], version: 1 },
      { id: 'e-2', date: '2026-09-30', kind: 'closed', note: 'Audit', sessions: [], version: 1 },
    ],
  };

  it('counts leave that ended yesterday at the hospital as over, though the PC is still on that day', () => {
    expect(todayISO()).toBe(PC_DATE);
    const lines = pastScheduleLines(history, todayIn(HOSPITAL_TIME_ZONE, Date.now()));
    expect(lines.map((l) => l.key)).toEqual(['leave:l-1', 'exception:e-2']);
    expect(lines[0]?.what).toBe('Sick leave · Fever');
  });

  it('keeps today’s exception out of the history', () => {
    const lines = pastScheduleLines(history, HOSPITAL_DATE);
    expect(lines.some((l) => l.key === 'exception:e-1')).toBe(false);
  });

  it('would have kept the ended leave current on the PC’s date', () => {
    expect(pastScheduleLines(history, todayISO()).map((l) => l.key)).toEqual(['exception:e-2']);
  });
});
