/**
 * Pure pricing rules for services, taxes and coupons (audit HA-04). Money is
 * an integer in whole rupees throughout, so nothing here can produce a
 * fractional paisa the receipt would have to hide.
 *
 * No React, no store — the services screen, the receipt and the booking flow
 * can all price an order the same way.
 */

import type {
  Coupon,
  CouponState,
  CouponType,
  HospitalService,
  PriceBreakdown,
  TaxLine,
  TaxRate,
} from './services.types';

const PERCENT = 100;

/** Percent coupons can never exceed this. */
export const MAX_PERCENT_COUPON = 100;

/**
 * Price one amount through the active taxes.
 *
 * `Exclusive` tax is added on top — the canonical case, because the receipt
 * prints tax as its own line and never bakes it into the displayed fee.
 * `Inclusive` tax is extracted out of the amount instead, so the total stays
 * what the patient was quoted.
 */
export function priceWithTaxes(amount: number, taxes: readonly TaxRate[]): PriceBreakdown {
  const active = taxes.filter((t) => t.active && t.percent > 0);
  const inclusive = active.filter((t) => t.mode === 'Inclusive');
  const exclusive = active.filter((t) => t.mode === 'Exclusive');

  // Everything inclusive shares one gross amount, so the net is the amount
  // divided by the combined rate — not each rate applied in turn.
  const inclusiveRate = inclusive.reduce((sum, t) => sum + t.percent, 0);
  const net = inclusiveRate > 0 ? Math.round(amount / (1 + inclusiveRate / PERCENT)) : amount;

  const lines: TaxLine[] = [
    ...inclusive.map((t) => ({
      name: t.name,
      percent: t.percent,
      mode: t.mode,
      amount: Math.round((net * t.percent) / PERCENT),
    })),
    ...exclusive.map((t) => ({
      name: t.name,
      percent: t.percent,
      mode: t.mode,
      amount: Math.round((net * t.percent) / PERCENT),
    })),
  ];

  const exclusiveTotal = lines
    .filter((l) => l.mode === 'Exclusive')
    .reduce((sum, l) => sum + l.amount, 0);

  return {
    base: net,
    taxes: lines,
    taxTotal: lines.reduce((sum, l) => sum + l.amount, 0),
    // Inclusive tax is already inside `amount`; only exclusive tax is added.
    total: amount + exclusiveTotal,
  };
}

/** Discount a coupon takes off `orderValue`, in whole rupees, never negative. */
export function couponDiscount(coupon: Coupon, orderValue: number): number {
  if (orderValue < coupon.minOrder) return 0;
  const raw =
    coupon.type === 'Percent'
      ? Math.floor((orderValue * Math.min(coupon.value, MAX_PERCENT_COUPON)) / PERCENT)
      : coupon.value;
  return Math.max(0, Math.min(raw, orderValue));
}

/** Availability of a coupon on `today` (ISO `yyyy-mm-dd`). */
export function couponStateOn(coupon: Coupon, today: string): CouponState {
  if (!coupon.active) return 'Paused';
  if (coupon.usageCap > 0 && coupon.used >= coupon.usageCap) return 'Exhausted';
  if (coupon.to && coupon.to < today) return 'Expired';
  if (coupon.from && coupon.from > today) return 'Scheduled';
  return 'Active';
}

/** Redemptions left, or null when the cap is unlimited. */
export function couponRemaining(coupon: Coupon): number | null {
  return coupon.usageCap > 0 ? Math.max(0, coupon.usageCap - coupon.used) : null;
}

/** Services a coupon may be redeemed against (empty scopes mean "all"). */
export function couponServices(
  coupon: Pick<Coupon, 'serviceIds' | 'departments'>,
  services: readonly HospitalService[],
): readonly HospitalService[] {
  const anyService = coupon.serviceIds.length === 0;
  const anyDept = coupon.departments.length === 0;
  if (anyService && anyDept) return services;
  return services.filter(
    (s) =>
      (anyService || coupon.serviceIds.includes(s.id)) &&
      (anyDept || coupon.departments.includes(s.dept)),
  );
}

/**
 * The highest flat discount that still makes sense: the cheapest service the
 * coupon applies to. A flat coupon above this would make that service free
 * (or negative), which is the check audit HA-04 asks for.
 */
export function flatCouponCeiling(
  coupon: Pick<Coupon, 'serviceIds' | 'departments'>,
  services: readonly HospitalService[],
): number | null {
  const scoped = couponServices(coupon, services);
  if (scoped.length === 0) return null;
  return scoped.reduce((min, s) => Math.min(min, s.price), Number.POSITIVE_INFINITY);
}

/**
 * Validate a coupon's value against its type and scope — returns a message to
 * show under the field, or `undefined` when it is acceptable.
 */
export function validateCouponValue(
  type: CouponType,
  value: number,
  ceiling: number | null,
): string | undefined {
  if (!Number.isFinite(value) || value <= 0) return 'Enter a discount greater than zero.';
  if (type === 'Percent') {
    return value > MAX_PERCENT_COUPON
      ? `A percent coupon cannot exceed ${MAX_PERCENT_COUPON}%.`
      : undefined;
  }
  if (ceiling != null && value > ceiling) {
    return `A flat coupon cannot exceed the service price — the cheapest applicable service is ₹ ${ceiling.toLocaleString('en-IN')}.`;
  }
  return undefined;
}

/** Coupon codes are stored upper-case with no spaces. */
export function normaliseCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** Scope copy for the coupon table: "All services" / "Cardiology · 2 services". */
export function couponScopeCopy(coupon: Coupon, services: readonly HospitalService[]): string {
  const parts: string[] = [];
  if (coupon.departments.length > 0) parts.push(coupon.departments.join(', '));
  if (coupon.serviceIds.length > 0) {
    const names = coupon.serviceIds
      .map((id) => services.find((s) => s.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    parts.push(names.length <= 2 ? names.join(', ') : `${names.length} services`);
  }
  return parts.length === 0 ? 'All services' : parts.join(' · ');
}
