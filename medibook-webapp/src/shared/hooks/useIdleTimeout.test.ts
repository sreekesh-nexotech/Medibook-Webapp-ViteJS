import { describe, expect, it } from 'vitest';

import { idlePhase } from '@/shared/hooks/useIdleTimeout';

const MINUTE = 60_000;
const TOTAL = 15 * MINUTE;
const WARN = MINUTE;

describe('idlePhase (UAT-04)', () => {
  it('is active until the warning window, reporting when to warn', () => {
    expect(idlePhase(0, TOTAL, WARN, 5 * MINUTE)).toEqual({
      phase: 'active',
      warnInMs: 9 * MINUTE,
    });
  });

  it('warns in the last minute, reporting when the session ends', () => {
    expect(idlePhase(0, TOTAL, WARN, 14.5 * MINUTE)).toEqual({
      phase: 'warning',
      expireInMs: 0.5 * MINUTE,
    });
  });

  it('expires at the deadline', () => {
    expect(idlePhase(0, TOTAL, WARN, TOTAL)).toEqual({ phase: 'expired' });
  });

  it('follows the latest input from any tab: activity elsewhere pushes the deadline back', () => {
    // This tab was idle since 0, another tab saw input at minute 10.
    expect(idlePhase(10 * MINUTE, TOTAL, WARN, 14.5 * MINUTE).phase).toBe('active');
  });
});
