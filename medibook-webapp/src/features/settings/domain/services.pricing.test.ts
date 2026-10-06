import { describe, expect, it } from 'vitest';

import {
  dayEndExclusiveIso,
  dayStartIso,
  lastValidDay,
} from '@/features/settings/domain/services.pricing';

describe('coupon validity windows (DATA-03)', () => {
  it("start and end on the hospital's midnights, not the device's", () => {
    expect(dayStartIso('2026-10-06')).toBe('2026-10-06T00:00:00+05:30');
    expect(dayEndExclusiveIso('2026-10-31')).toBe('2026-11-01T00:00:00+05:30');
  });

  it('reads the last valid day back as the day the user picked', () => {
    expect(lastValidDay(new Date(dayEndExclusiveIso('2026-10-31')).toISOString())).toBe(
      '2026-10-31',
    );
  });
});
