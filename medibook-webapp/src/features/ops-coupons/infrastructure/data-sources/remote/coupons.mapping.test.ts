import { describe, expect, it } from 'vitest';

import { toCouponWriteRequest } from '@/features/ops-coupons/infrastructure/data-sources/remote/coupons.request';
import {
  couponPageResponseSchema,
  couponUseResponseSchema,
  toCouponUse,
  toPlatformCoupon,
} from '@/features/ops-coupons/infrastructure/data-sources/remote/coupons.response';

/** As `GET /platform/coupons` answers (backend `PlatformCouponSerializer`). */
const ROW = {
  id: 'c-1',
  code: 'MONSOON15',
  kind: 'percent',
  value: 1500,
  max_discount_paise: 20000,
  min_order_paise: 30000,
  valid_from: '2026-12-01T00:00:00+05:30',
  valid_to: '2027-01-01T00:00:00+05:30',
  usage_cap: 500,
  per_user_cap: 1,
  used_count: 12,
  applies_to_online_only: true,
  is_active: true,
  funded_by: 'platform',
  created_at: '2026-11-26T11:00:00Z',
  updated_at: '2026-11-26T11:00:00Z',
  version: 2,
};

describe('Medibook coupon mapping (point 9)', () => {
  it('reads a coupon page into rupees and whole percent', () => {
    const page = couponPageResponseSchema.parse({
      results: [ROW],
      page: 1,
      page_size: 100,
      total: 1,
      has_next: false,
    });
    const [row] = page.results;
    if (!row) throw new Error('expected a row');
    expect(toPlatformCoupon(row)).toMatchObject({
      code: 'MONSOON15',
      kind: 'percent',
      value: 15,
      maxDiscountRupees: 200,
      minOrderRupees: 300,
      usageCap: 500,
      perUserCap: 1,
      usedCount: 12,
      version: 2,
    });
  });

  it('sends rupees and percent back as paise and basis points, never who pays', () => {
    const input = {
      code: 'FIRST100',
      kind: 'flat' as const,
      value: 100,
      maxDiscountRupees: 50, // ignored for a flat coupon
      minOrderRupees: 0,
      validFrom: '2026-12-01T00:00:00+05:30',
      validTo: '2027-01-01T00:00:00+05:30',
      usageCap: null,
      perUserCap: 1,
      isActive: true,
    };
    const flat = toCouponWriteRequest(input);
    expect(flat).toMatchObject({ value: 10000, max_discount_paise: null, min_order_paise: 0 });
    expect('funded_by' in flat || 'applies_to_online_only' in flat).toBe(false);
    const percent = toCouponWriteRequest({
      ...input,
      kind: 'percent',
      value: 15,
      maxDiscountRupees: 200,
    });
    expect(percent).toMatchObject({ value: 1500, max_discount_paise: 20000 });
  });

  it('reads a use: the booking ref and hospital, the discount in rupees', () => {
    const use = toCouponUse(
      couponUseResponseSchema.parse({
        id: 'r-1',
        hospital_id: 'h-1',
        hospital_name: 'Lakeshore Multispeciality Hospital',
        appointment_id: 'a-1',
        booking_ref: 'LKSB-2611-00227',
        discount_paise: 10000,
        funded_by: 'platform',
        redeemed_at: '2026-11-26T11:30:00Z',
        reversed_at: null,
      }),
    );
    expect(use).toEqual({
      id: 'r-1',
      hospitalName: 'Lakeshore Multispeciality Hospital',
      bookingRef: 'LKSB-2611-00227',
      discountRupees: 100,
      redeemedAt: '2026-11-26T11:30:00Z',
      reversedAt: null,
    });
  });
});
