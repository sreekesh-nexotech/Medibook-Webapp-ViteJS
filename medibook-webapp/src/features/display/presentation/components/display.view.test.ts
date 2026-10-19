import { describe, expect, it } from 'vitest';

import type { DisplaySession } from '@/features/display/domain/entities/display.types';
import {
  boardDateLabel,
  latestCall,
  orderSessions,
  sessionStateLabel,
  waitingLabel,
} from '@/features/display/presentation/components/display.view';

const base: DisplaySession = {
  id: 's1',
  label: 'Morning',
  status: 'open',
  queueState: 'available',
  doctorName: 'Dr. B',
  room: null,
  counterCode: null,
  currentToken: null,
  currentPatient: null,
  lastCalledToken: null,
  lastCalledAt: null,
  waitingCount: 0,
};

describe('display view', () => {
  it('labels each session state for the hall', () => {
    expect(sessionStateLabel({ ...base, currentToken: 'A003' })).toBe('Now consulting');
    expect(sessionStateLabel(base)).toBe('Waiting for the next token');
    expect(sessionStateLabel({ ...base, status: 'paused' })).toBe('On a short break');
    expect(sessionStateLabel({ ...base, status: 'closed' })).toBe('Session closed');
    expect(sessionStateLabel({ ...base, status: 'scheduled' })).toBe('Not started yet');
  });

  it('counts the waiting patients', () => {
    expect(waitingLabel(3)).toBe('3 waiting');
    expect(waitingLabel(0)).toBe('No one waiting');
  });

  it('puts open sessions first and closed ones last', () => {
    const ordered = orderSessions([
      { ...base, id: 'c', status: 'closed', doctorName: 'Dr. A' },
      { ...base, id: 's', status: 'scheduled', doctorName: 'Dr. A' },
      { ...base, id: 'o', doctorName: 'Dr. Z' },
    ]);
    expect(ordered.map((s) => s.id)).toEqual(['o', 's', 'c']);
  });

  it('reads the board date as a calendar date', () => {
    expect(boardDateLabel('2026-10-16')).toBe('Friday, 16 October 2026');
    expect(boardDateLabel('bad')).toBe('bad');
  });

  it('announces only a call newer than the last one seen', () => {
    const a = { ...base, id: 'a', currentToken: 'A003', lastCalledAt: '2026-10-16T04:00:00Z' };
    const b = { ...base, id: 'b', currentToken: 'W002', lastCalledAt: '2026-10-16T04:05:00Z' };
    expect(latestCall([a, b], null)?.id).toBe('b');
    expect(latestCall([a, b], '2026-10-16T04:05:00Z')).toBeNull();
    expect(latestCall([a, b], '2026-10-16T04:01:00Z')?.id).toBe('b');
    expect(latestCall([base], null)).toBeNull();
  });
});
