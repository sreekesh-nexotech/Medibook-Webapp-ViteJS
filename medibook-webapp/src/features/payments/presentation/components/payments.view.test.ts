import { describe, expect, it } from 'vitest';

import {
  drawerBalance,
  paiseToRupees,
  rupeesToPaise,
} from '@/features/payments/presentation/components/payments.view';

describe('rupeesToPaise', () => {
  it('reads what the front desk types as whole paise', () => {
    expect(rupeesToPaise('500')).toBe(50000);
    expect(rupeesToPaise('0')).toBe(0);
    expect(rupeesToPaise('1,250.75')).toBe(125075);
    expect(rupeesToPaise('0.10')).toBe(10);
  });

  it('refuses amounts the drawer cannot hold', () => {
    expect(rupeesToPaise('12.345')).toBeNull();
    expect(rupeesToPaise('-500')).toBeNull();
    expect(rupeesToPaise('five hundred')).toBeNull();
  });
});

describe('paiseToRupees', () => {
  it('converts paise back to rupees for display', () => {
    expect(paiseToRupees(95000)).toBe(950);
    expect(paiseToRupees(50)).toBe(0.5);
  });
});

describe('drawerBalance', () => {
  it('compares the counted cash with what the server expected', () => {
    expect(drawerBalance(0)).toBe('balanced');
    expect(drawerBalance(-5000)).toBe('short');
    expect(drawerBalance(100)).toBe('over');
  });
});
