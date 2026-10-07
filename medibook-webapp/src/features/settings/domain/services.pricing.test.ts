import { describe, expect, it } from 'vitest';

import type { ServiceTaxRate } from '@/features/settings/domain/entities/services.entities';
import {
  couponDiscount,
  dayEndExclusiveIso,
  dayStartIso,
  lastValidDay,
  priceService,
} from '@/features/settings/domain/services.pricing';

const rate = (percent: number, isInclusive = false, isActive = true): ServiceTaxRate => ({
  id: 'tax',
  code: 'GST',
  name: 'GST',
  percent,
  isInclusive,
  appliesTo: 'service',
  isActive,
  isPlatformDefault: false,
  version: 1,
});

/** Expected values are the backend's own formulas (`core/money.py`, `fees._line_tax`). */
describe('priceService (matches the backend fee engine)', () => {
  it('rounds an added-on tax line half-up to the rupee', () => {
    // ECG on the test backend: ₹300 with Diagnostics GST 5%.
    expect(priceService(300, rate(5))).toEqual({
      base: 300,
      tax: 15,
      isInclusive: false,
      total: 315,
    });
    expect(priceService(333, rate(18)).tax).toBe(60);
  });

  it('breaks inclusive tax out to the paisa, inside the price', () => {
    expect(priceService(1000, rate(18, true))).toEqual({
      base: 1000,
      tax: 152.54,
      isInclusive: true,
      total: 1000,
    });
  });

  it('still charges a service’s rate after the rate is switched off', () => {
    expect(priceService(300, rate(5, false, false)).total).toBe(315);
  });

  it('treats no rate as exempt', () => {
    expect(priceService(300, null).total).toBe(300);
  });
});

describe('couponDiscount', () => {
  // A typical coupon: 10%, at most ₹200.
  const save10 = { kind: 'percent' as const, value: 10, minOrderRupees: 0, maxDiscountRupees: 200 };

  it('caps a percent discount at its maximum', () => {
    expect(couponDiscount(save10, 2000)).toBe(200);
    expect(couponDiscount(save10, 5000)).toBe(200);
    expect(couponDiscount(save10, 500)).toBe(50);
  });

  it('gives nothing below the minimum order', () => {
    expect(couponDiscount({ ...save10, minOrderRupees: 1000 }, 999)).toBe(0);
  });

  it('never takes a flat discount past the order value', () => {
    expect(
      couponDiscount({ kind: 'flat', value: 500, minOrderRupees: 0, maxDiscountRupees: null }, 300),
    ).toBe(300);
  });
});

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
