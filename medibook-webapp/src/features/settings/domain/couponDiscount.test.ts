import { describe, expect, it } from 'vitest';

import { couponDiscount } from '@/features/settings/domain/services.pricing';

const percent = (value: number, maxDiscountRupees: number | null = null) => ({
  kind: 'percent' as const,
  value,
  minOrderRupees: 0,
  maxDiscountRupees,
});

describe('coupon preview matches the bill (DATA-10)', () => {
  it('stops a percent coupon at its cap', () => {
    // The seeded coupon: 10% off, at most ₹200.
    expect(couponDiscount(percent(10, 200), 5000)).toBe(200);
    expect(couponDiscount(percent(10, 200), 1500)).toBe(150);
  });

  it('rounds half-up to the paisa like the server, not down to the rupee', () => {
    // 12.5% of ₹999 = ₹124.875 → ₹124.88 (the old preview said ₹124).
    expect(couponDiscount(percent(12.5), 999)).toBe(124.88);
  });

  it('never takes more than the order, and honours the minimum order', () => {
    expect(couponDiscount({ kind: 'flat', value: 600, minOrderRupees: 0 }, 500)).toBe(500);
    expect(couponDiscount({ kind: 'flat', value: 100, minOrderRupees: 1000 }, 999)).toBe(0);
  });
});
