import { describe, expect, it } from 'vitest';

import type { Holiday } from '@/features/settings/domain/entities/profile.entities';
import { closedDaysWithin } from '@/features/settings/application/store/profile.form';

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
