import type {
  HospitalCoupon,
  PricedService,
  ServiceTaxRate,
} from '@/features/settings/domain/entities/services.entities';

/**
 * Pure pricing rules, mirroring the backend's fee engine
 * (`catalog/services/fees.py`, `core/money.py`) so the screen shows what a
 * receipt will. Worked in paise, like the backend:
 * - a service is taxed only by its **own** tax rate (none = exempt) — and the
 *   backend charges that rate even after it is switched off (BACKEND_BLOCKERS
 *   SVC-01), so this does too;
 * - an added-on tax line is rounded half-up to the rupee (`round_tax_paise`);
 * - inclusive tax is informational, broken out to the paisa, already inside
 *   the price;
 * - a percent coupon is rounded half-up to the paisa (`apply_bp`) and capped
 *   at its maximum discount.
 */

const PAISE_PER_RUPEE = 100;
/** Basis points in 100% (the backend's `BP_DENOMINATOR`). */
const BP = 10_000;
const BP_PER_PERCENT = 100;

function toPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

function toBp(percent: number): number {
  return Math.round(percent * BP_PER_PERCENT);
}

/** `round_tax_paise`: amount × rate, half-up to the whole rupee, in paise. */
function roundTaxPaise(amountPaise: number, rateBp: number): number {
  if (rateBp === 0 || amountPaise === 0) return 0;
  const unit = PAISE_PER_RUPEE * BP;
  return Math.floor((amountPaise * rateBp + unit / 2) / unit) * PAISE_PER_RUPEE;
}

/** `apply_bp`: a basis-point share, half-up to the paisa. */
function applyBp(amountPaise: number, rateBp: number): number {
  return Math.floor((amountPaise * rateBp + BP / 2) / BP);
}

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

/** Price a service with its own tax rate (or none), as the receipt line will. */
export function priceService(base: number, tax: ServiceTaxRate | null): ServicePrice {
  const rateBp = tax ? toBp(tax.percent) : 0;
  if (!tax || rateBp <= 0) {
    return { base, tax: 0, isInclusive: false, total: base };
  }
  const basePaise = toPaise(base);
  if (tax.isInclusive) {
    const preTax = Math.floor((basePaise * BP + Math.floor((BP + rateBp) / 2)) / (BP + rateBp));
    return { base, tax: (basePaise - preTax) / PAISE_PER_RUPEE, isInclusive: true, total: base };
  }
  const amount = roundTaxPaise(basePaise, rateBp) / PAISE_PER_RUPEE;
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

/**
 * Discount a coupon takes off `orderValue` (rupees, may carry paise), never
 * negative: a percent coupon is capped at its maximum discount, a flat one at
 * the order value.
 */
export function couponDiscount(
  coupon: Pick<HospitalCoupon, 'kind' | 'value' | 'minOrderRupees' | 'maxDiscountRupees'>,
  orderValue: number,
): number {
  if (orderValue < coupon.minOrderRupees) return 0;
  const orderPaise = toPaise(orderValue);
  let discount: number;
  if (coupon.kind === 'percent') {
    discount = applyBp(orderPaise, toBp(Math.min(coupon.value, MAX_PERCENT_COUPON)));
    if (coupon.maxDiscountRupees !== null) {
      discount = Math.min(discount, toPaise(coupon.maxDiscountRupees));
    }
  } else {
    discount = toPaise(coupon.value);
  }
  return Math.max(0, Math.min(discount, orderPaise)) / PAISE_PER_RUPEE;
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
