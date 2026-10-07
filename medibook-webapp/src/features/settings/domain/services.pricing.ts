import type {
  HospitalCoupon,
  PricedService,
  ServiceTaxRate,
} from '@/features/settings/domain/entities/services.entities';
import { addDaysISO, calendarDate, calendarInstant } from '@/shared/lib/format';

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

/** ISO date-time → the day `yyyy-mm-dd` it falls on in the hospital's calendar. */
export function localDay(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  return Number.isNaN(date.getTime()) ? '' : calendarDate(date);
}

/** One millisecond — `valid_to` is exclusive, so its last valid instant is just before it. */
const ONE_MS = 1;

/** The last hospital day a coupon is valid on (`valid_to` is an exclusive instant). */
export function lastValidDay(validTo: string): string {
  const end = Date.parse(validTo);
  return Number.isNaN(end) ? '' : calendarDate(end - ONE_MS);
}

/** `yyyy-mm-dd` → the instant that day starts in the hospital's zone (DATA-03). */
export function dayStartIso(day: string): string {
  return calendarInstant(day);
}

/** `yyyy-mm-dd` → the exclusive end of that day: the hospital's next midnight. */
export function dayEndExclusiveIso(day: string): string {
  return calendarInstant(addDaysISO(day, 1));
}

export function couponState(coupon: HospitalCoupon, today: string): CouponState {
  if (!coupon.isActive) return 'Paused';
  if (coupon.usageCap !== null && coupon.usedCount >= coupon.usageCap) return 'Exhausted';
  if (lastValidDay(coupon.validTo) < today) return 'Expired';
  if (localDay(coupon.validFrom) > today) return 'Scheduled';
  return 'Active';
}

/**
 * Discount a coupon takes off `orderValue` (rupees), worked out in paise exactly
 * as the bill is (backend `catalog/services/fees.py`, `core/money.apply_bp`): a
 * percent coupon rounds half-up to the paisa and stops at its cap, and no
 * coupon takes more than the order (DATA-10).
 */
export function couponDiscount(
  coupon: Pick<HospitalCoupon, 'kind' | 'value' | 'minOrderRupees'> &
    Partial<Pick<HospitalCoupon, 'maxDiscountRupees'>>,
  orderValue: number,
): number {
  const orderPaise = toPaise(orderValue);
  if (orderPaise < toPaise(coupon.minOrderRupees)) return 0;
  let discount: number;
  if (coupon.kind === 'percent') {
    discount = applyBp(orderPaise, toBp(Math.min(coupon.value, MAX_PERCENT_COUPON)));
    const cap = coupon.maxDiscountRupees;
    if (cap != null) discount = Math.min(discount, toPaise(cap));
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
