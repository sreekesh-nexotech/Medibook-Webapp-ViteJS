import { describe, expect, it } from 'vitest';

import {
  couponState,
  dayEndExclusive,
  dayOf,
  dayStart,
  discountLabel,
  discountOn,
  fromApiValue,
  lastDayOf,
  normaliseCode,
  toApiValue,
} from '@/features/ops-coupons/domain/couponRules';
import type { PlatformCoupon } from '@/features/ops-coupons/domain/entities/coupons.entities';

const NOW = Date.parse('2026-12-10T06:00:00Z');

const base: PlatformCoupon = {
  id: 'c-1',
  code: 'FIRST100',
  kind: 'flat',
  value: 100,
  maxDiscountRupees: null,
  minOrderRupees: 0,
  validFrom: '2026-12-01T00:00:00+05:30',
  validTo: '2027-01-01T00:00:00+05:30',
  usageCap: null,
  perUserCap: 1,
  usedCount: 0,
  isActive: true,
  createdAt: '2026-11-26T00:00:00Z',
  version: 1,
};

describe('Medibook coupon rules (point 9)', () => {
  it('works out the state the way the backend checks it', () => {
    expect(couponState(base, NOW)).toBe('Active');
    expect(couponState({ ...base, isActive: false }, NOW)).toBe('Paused');
    expect(couponState({ ...base, usageCap: 5, usedCount: 5 }, NOW)).toBe('Used up');
    expect(couponState({ ...base, validTo: '2026-12-10T06:00:00Z' }, NOW)).toBe('Expired');
    expect(couponState({ ...base, validFrom: '2026-12-10T06:00:01Z' }, NOW)).toBe('Scheduled');
  });

  it('describes the discount', () => {
    expect(discountLabel(base)).toBe('₹100 off');
    expect(discountLabel({ kind: 'percent', value: 10, maxDiscountRupees: null })).toBe('10% off');
    expect(discountLabel({ kind: 'percent', value: 20, maxDiscountRupees: 150 })).toBe(
      '20% off (up to ₹150)',
    );
  });

  it('prices the discount like the bill: half-up, capped, never above the fee', () => {
    const pct = { kind: 'percent' as const, value: 15, minOrderRupees: 0, maxDiscountRupees: null };
    expect(discountOn(pct, 499)).toBe(75); // 74.85 rounds half-up to the rupee
    expect(discountOn({ ...pct, maxDiscountRupees: 50 }, 499)).toBe(50);
    expect(discountOn({ ...base, value: 800 }, 500)).toBe(500); // a flat coupon stops at the fee
    expect(discountOn({ ...base, minOrderRupees: 600 }, 500)).toBe(0); // below the minimum
  });

  it('converts values to and from the API units', () => {
    expect(toApiValue('percent', 12.5)).toBe(1250); // basis points
    expect(toApiValue('flat', 100)).toBe(10000); // paise
    expect(fromApiValue('percent', 1250)).toBe(12.5);
    expect(fromApiValue('flat', 10000)).toBe(100);
  });

  it('turns whole days into the exclusive validity window and back', () => {
    const from = dayStart('2026-12-01');
    const to = dayEndExclusive('2026-12-31');
    expect(dayOf(from)).toBe('2026-12-01');
    expect(lastDayOf(to)).toBe('2026-12-31');
    expect(Date.parse(to) - Date.parse(dayStart('2027-01-01'))).toBe(0);
  });

  it('normalises codes', () => {
    expect(normaliseCode('  first 100 ')).toBe('FIRST100');
  });
});
