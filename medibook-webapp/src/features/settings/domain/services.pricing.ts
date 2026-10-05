import type {
  HospitalCoupon,
  PricedService,
  ServiceTaxRate,
} from '@/features/settings/domain/entities/services.entities';

/**
 * Pure pricing rules, mirroring the backend's fee engine
 * (`catalog/services/fees.py`) so the screen shows what a receipt will:
 * a service is taxed only by its **own** tax rate (none = exempt), each tax
 * line is rounded half-up to the rupee, and inclusive tax is informational —
 * already inside the price, not added on top.
 */

const PERCENT = 100;
const HALF = 0.5;

/** Highest discount a percent coupon may carry. */
export const MAX_PERCENT_COUPON = 100;

export interface ServicePrice {
  /** The listed price. */
  readonly base: number;
  /** The tax amount on the receipt line (inside the price when inclusive). */
  readonly tax: number;
  readonly isInclusive: boolean;
  /** What the patient pays. */
  readonly total: number;
}

/** Price a service with its own tax rate (or none). */
export function priceService(base: number, tax: ServiceTaxRate | null): ServicePrice {
  if (!tax || !tax.isActive || tax.percent <= 0) {
    return { base, tax: 0, isInclusive: false, total: base };
  }
  if (tax.isInclusive) {
    const preTax = Math.floor((base * PERCENT) / (PERCENT + tax.percent) + HALF);
    return { base, tax: base - preTax, isInclusive: true, total: base };
  }
  const amount = Math.floor((base * tax.percent) / PERCENT + HALF);
  return { base, tax: amount, isInclusive: false, total: base + amount };
}

/** Rates a hospital may attach to a service (active, for services or everything). */
export function serviceTaxOptions(rates: readonly ServiceTaxRate[]): readonly ServiceTaxRate[] {
  return rates.filter((r) => r.isActive && (r.appliesTo === 'service' || r.appliesTo === 'all'));
}

/** Derived availability of a coupon on a given local day. */
export type CouponState = 'Active' | 'Scheduled' | 'Expired' | 'Exhausted' | 'Paused';

/** ISO date-time → the local calendar day `yyyy-mm-dd`. */
export function localDay(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** One millisecond — `valid_to` is exclusive, so its last valid instant is just before it. */
const ONE_MS = 1;

/** The last local day a coupon is valid on (`valid_to` is an exclusive instant). */
export function lastValidDay(validTo: string): string {
  const end = Date.parse(validTo);
  return Number.isNaN(end) ? '' : localDay(new Date(end - ONE_MS).toISOString());
}

/** Local `yyyy-mm-dd` → the instant that day starts, as ISO (UTC). */
export function dayStartIso(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString();
}

/** Local `yyyy-mm-dd` → the exclusive end instant of that day (next local midnight), as ISO. */
export function dayEndExclusiveIso(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d + 1).toISOString();
}

export function couponState(coupon: HospitalCoupon, today: string): CouponState {
  if (!coupon.isActive) return 'Paused';
  if (coupon.usageCap !== null && coupon.usedCount >= coupon.usageCap) return 'Exhausted';
  if (lastValidDay(coupon.validTo) < today) return 'Expired';
  if (localDay(coupon.validFrom) > today) return 'Scheduled';
  return 'Active';
}

/** Discount a coupon takes off `orderValue`, whole rupees, never negative. */
export function couponDiscount(
  coupon: Pick<HospitalCoupon, 'kind' | 'value' | 'minOrderRupees'>,
  orderValue: number,
): number {
  if (orderValue < coupon.minOrderRupees) return 0;
  const raw =
    coupon.kind === 'percent'
      ? Math.floor((orderValue * Math.min(coupon.value, MAX_PERCENT_COUPON)) / PERCENT)
      : coupon.value;
  return Math.max(0, Math.min(raw, orderValue));
}

/**
 * Services a coupon may be redeemed against. No scope = every service; with
 * scopes, a booking qualifies when **any** scope matches — its service, or its
 * department (the backend's rule, `fees.validate_coupon`).
 */
export function couponServices(
  scope: Pick<HospitalCoupon, 'serviceIds' | 'departmentIds'>,
  services: readonly PricedService[],
): readonly PricedService[] {
  if (scope.serviceIds.length === 0 && scope.departmentIds.length === 0) return services;
  return services.filter(
    (s) =>
      scope.serviceIds.includes(s.id) ||
      (s.departmentId !== null && scope.departmentIds.includes(s.departmentId)),
  );
}

/** Highest sensible flat discount: the cheapest service in scope (null = none in scope). */
export function flatCouponCeiling(
  scope: Pick<HospitalCoupon, 'serviceIds' | 'departmentIds'>,
  services: readonly PricedService[],
): number | null {
  const scoped = couponServices(scope, services);
  if (scoped.length === 0) return null;
  return scoped.reduce((min, s) => Math.min(min, s.priceRupees), Number.POSITIVE_INFINITY);
}
