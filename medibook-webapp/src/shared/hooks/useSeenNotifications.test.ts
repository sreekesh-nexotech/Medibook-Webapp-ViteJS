import { describe, expect, it } from 'vitest';

import { parseSeen, serialiseSeen } from '@/shared/hooks/useSeenNotifications';

describe('bell read state (UAT-68)', () => {
  it('round-trips the read keys', () => {
    const keys = ['2 bookings awaiting approval', '1 settlement on hold'];
    expect([...parseSeen(serialiseSeen(keys))]).toEqual(keys);
  });

  it('treats missing or corrupt storage as nothing read', () => {
    expect(parseSeen(null).size).toBe(0);
    expect(parseSeen('{not json').size).toBe(0);
    expect(parseSeen('{"a":1}').size).toBe(0);
    expect([...parseSeen('["a", 2, "b"]')]).toEqual(['a', 'b']);
  });

  it('keeps only the most recent keys', () => {
    const many = Array.from({ length: 80 }, (_, i) => `item ${i}`);
    const kept = parseSeen(serialiseSeen(many));
    expect(kept.size).toBe(50);
    expect(kept.has('item 79')).toBe(true);
    expect(kept.has('item 0')).toBe(false);
  });
});
