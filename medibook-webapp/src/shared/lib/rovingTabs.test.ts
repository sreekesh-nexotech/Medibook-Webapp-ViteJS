import { describe, expect, it } from 'vitest';

import { nextTabIndex } from '@/shared/lib/rovingTabs';

describe('nextTabIndex (UAT-76)', () => {
  it('moves with the arrows and wraps', () => {
    expect(nextTabIndex('ArrowRight', 0, 3)).toBe(1);
    expect(nextTabIndex('ArrowRight', 2, 3)).toBe(0);
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextTabIndex('ArrowDown', 1, 3)).toBe(2);
    expect(nextTabIndex('ArrowUp', 1, 3)).toBe(0);
  });

  it('jumps with Home and End and ignores other keys', () => {
    expect(nextTabIndex('Home', 2, 3)).toBe(0);
    expect(nextTabIndex('End', 0, 3)).toBe(2);
    expect(nextTabIndex('Enter', 0, 3)).toBeNull();
    expect(nextTabIndex('ArrowRight', 0, 0)).toBeNull();
  });
});
