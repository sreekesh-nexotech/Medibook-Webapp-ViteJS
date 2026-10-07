import { describe, expect, it } from 'vitest';

import type { ServiceTaxRate } from '@/features/settings/domain/entities/services.entities';
import {
  chargedServiceRate,
  cheapestConsultationRupees,
  couponDiscount,
  priceService,
} from '@/features/settings/domain/services.pricing';

const rate = (
  percent: number,
  isInclusive = false,
  isActive = true,
  appliesTo: ServiceTaxRate['appliesTo'] = 'service',
): ServiceTaxRate => ({
  id: 'tax',
  code: 'GST',
  name: 'GST',
  percent,
  isInclusive,
  appliesTo,
  isActive,
  isPlatformDefault: false,
  servicesCount: null,
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

  it('rounds the tax inside an inclusive price half-up to the rupee (L-22)', () => {
    expect(priceService(1000, rate(18, true))).toEqual({
      base: 1000,
      tax: 153,
      isInclusive: true,
      total: 1000,
    });
    expect(priceService(1, rate(100, true)).tax).toBe(1);
  });

  it('bills a service exempt once its rate is off or no longer for services (BE-10, UAT-09)', () => {
    expect(chargedServiceRate(rate(5))).not.toBeNull();
    expect(chargedServiceRate(rate(5, false, true, 'all'))).not.toBeNull();
    expect(chargedServiceRate(rate(5, false, false))).toBeNull();
    expect(chargedServiceRate(rate(5, false, true, 'consultation'))).toBeNull();
    expect(chargedServiceRate(null)).toBeNull();
    expect(priceService(300, chargedServiceRate(rate(5, false, false))).total).toBe(300);
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

describe('cheapestConsultationRupees (decision 7)', () => {
  const doctors = [
    { departmentId: 'cardio', feePaise: 80_000 },
    { departmentId: 'cardio', feePaise: 60_000 },
    { departmentId: 'ortho', feePaise: 50_000 },
  ];

  it('is the lowest consultation fee in the coupon’s departments', () => {
    expect(cheapestConsultationRupees(doctors, ['cardio'])).toBe(600);
    expect(cheapestConsultationRupees(doctors, [])).toBe(500);
    expect(cheapestConsultationRupees(doctors, ['derm'])).toBeNull();
  });
});
