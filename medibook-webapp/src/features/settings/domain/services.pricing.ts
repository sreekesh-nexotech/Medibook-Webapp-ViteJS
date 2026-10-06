import type {
  HospitalCoupon,
  PricedService,
  ServiceTaxRate,
} from '@/features/settings/domain/entities/services.entities';
import { addDaysISO, calendarDate, calendarInstant } from '@/shared/lib/format';

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

const PAISE_PER_RUPEE = 100;
const BP_PER_PERCENT = 100;
const BP_DENOMINATOR = 10_000;

function toPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
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
    const rateBp = Math.round(Math.min(coupon.value, MAX_PERCENT_COUPON) * BP_PER_PERCENT);
    discount = Math.floor((orderPaise * rateBp + BP_DENOMINATOR / 2) / BP_DENOMINATOR);
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
