import { describe, expect, it } from 'vitest';

import type { WeeklySession } from '@/features/doctors/domain/entities/doctors.types';
import {
  gridToSessions,
  sameSessions,
  sessionsToGrid,
} from '@/features/doctors/presentation/components/doctors.view';

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
