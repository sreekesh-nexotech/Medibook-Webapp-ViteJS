import { describe, expect, it } from 'vitest';

import type { DisplaySession } from '@/features/display/domain/entities/display.types';
import {
  boardDateLabel,
  boardRows,
  latestCall,
  offTodayLabel,
  pageCount,
  pageOf,
  rowsThatFit,
  sessionStateLabel,
  tokenNumber,
  waitingLabel,
} from '@/features/display/presentation/components/display.view';

const base: DisplaySession = {
  id: 's1',
  label: 'Morning',
  status: 'open',
  queueState: 'available',
  doctorId: 'doc-b',
  doctorName: 'Dr. B',
  room: null,
  counterCode: null,
  currentToken: null,
  currentTokenNo: null,
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

  it('shows the plain token number, or the label from an older backend', () => {
    expect(tokenNumber({ ...base, currentToken: 'A003', currentTokenNo: 3 })).toBe('3');
    expect(tokenNumber({ ...base, currentToken: 'A003' })).toBe('A003');
    expect(tokenNumber(base)).toBeNull();
  });

  it('gives each doctor one row: the running session, else the next, else the finished one', () => {
    const rows = boardRows({
      sessions: [
        { ...base, id: 'b-morning', doctorId: 'b', status: 'closed' },
        { ...base, id: 'b-evening', doctorId: 'b', status: 'scheduled' },
        { ...base, id: 'c-break', doctorId: 'c', doctorName: 'Dr. C', status: 'paused' },
        { ...base, id: 'c-open', doctorId: 'c', doctorName: 'Dr. C', status: 'open' },
      ],
      doctorsOffToday: [],
    });
    expect(rows.map((r) => r.key)).toEqual(['s:b-evening', 's:c-open']);
  });

  it('lists working doctors by name, then finished ones, then doctors off today', () => {
    const rows = boardRows({
      sessions: [
        { ...base, id: 'z', doctorId: 'z', doctorName: 'Dr. Z' },
        { ...base, id: 'a', doctorId: 'a', doctorName: 'Dr. A', status: 'closed' },
        { ...base, id: 'm', doctorId: 'm', doctorName: 'Dr. M', status: 'scheduled' },
      ],
      doctorsOffToday: [
        { id: 'y', name: 'Dr. Y', room: '450', status: 'active' },
        { id: 'z', name: 'Dr. Z', room: null, status: 'active' }, // already on the board
        { id: 'k', name: 'Dr. K', room: null, status: 'on_leave' },
      ],
    });
    expect(rows.map((r) => r.key)).toEqual(['s:m', 's:z', 's:a', 'd:y', 'd:k']);
  });

  it('keeps sessions apart by name when an older backend sends no doctor id', () => {
    const rows = boardRows({
      sessions: [
        { ...base, id: '1', doctorId: '', doctorName: 'Dr. A' },
        { ...base, id: '2', doctorId: '', doctorName: 'Dr. B' },
      ],
      doctorsOffToday: [],
    });
    expect(rows).toHaveLength(2);
  });

  it('says why a doctor is off today', () => {
    expect(offTodayLabel({ id: 'k', name: 'K', room: null, status: 'on_leave' })).toBe(
      'On leave today',
    );
    expect(offTodayLabel({ id: 'y', name: 'Y', room: null, status: 'active' })).toBe(
      'Not available today',
    );
  });

  it('pages rows that do not fit, and wraps around', () => {
    const rows = [1, 2, 3, 4, 5];
    expect(pageCount(rows.length, 2)).toBe(3);
    expect(pageOf(rows, 2, 0)).toEqual([1, 2]);
    expect(pageOf(rows, 2, 2)).toEqual([5]);
    expect(pageOf(rows, 2, 3)).toEqual([1, 2]);
    expect(pageOf(rows, 10, 0)).toEqual(rows);
    expect(pageOf(rows, 0, 1)).toEqual(rows); // not measured yet: show everything
    expect(pageCount(0, 4)).toBe(1);
  });

  it('works out how many rows fit, never fewer than one', () => {
    // 1080p board: rows 6cqw = 115.2px, gap 0.6cqw = 11.52px, 1920px wide
    expect(rowsThatFit(800, 115.2, 11.52)).toBe(6);
    expect(rowsThatFit(50, 115.2, 11.52)).toBe(1);
    expect(rowsThatFit(800, 0, 0)).toBe(0);
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
