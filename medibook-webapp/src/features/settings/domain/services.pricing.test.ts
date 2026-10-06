import { describe, expect, it } from 'vitest';

import type { ServiceTaxRate } from '@/features/settings/domain/entities/services.entities';
import { couponDiscount, priceService } from '@/features/settings/domain/services.pricing';

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
  // LAKE10 on the test backend: 10%, at most ₹200.
  const lake10 = { kind: 'percent' as const, value: 10, minOrderRupees: 0, maxDiscountRupees: 200 };

  it('caps a percent discount at its maximum', () => {
    expect(couponDiscount(lake10, 2000)).toBe(200);
    expect(couponDiscount(lake10, 5000)).toBe(200);
    expect(couponDiscount(lake10, 500)).toBe(50);
  });

  it('gives nothing below the minimum order', () => {
    expect(couponDiscount({ ...lake10, minOrderRupees: 1000 }, 999)).toBe(0);
  });

  it('never takes a flat discount past the order value', () => {
    expect(
      couponDiscount({ kind: 'flat', value: 500, minOrderRupees: 0, maxDiscountRupees: null }, 300),
    ).toBe(300);
  });
});
