import type {
  HospitalCoupon,
  ServiceTaxRate,
} from '@/features/settings/domain/entities/services.entities';

/**
 * Pure pricing rules, mirroring the backend's fee engine
 * (`catalog/services/fees.py`, `core/money.py`) so the screen shows what a
 * receipt will. Worked in paise, like the backend:
 * - a service is taxed only by its **own** tax rate, and only while that rate
 *   is switched on and applies to services (`fees.service_tax_rate`, BE-10):
 *   a deleted, switched-off or consultation-only rate bills the service
 *   exempt (`chargedServiceRate`);
 * - an added-on tax line is rounded half-up to the rupee (`round_tax_paise`);
 * - inclusive tax is already inside the price; the amount it contains is
 *   rounded half-up to the rupee too (`inclusive_tax_paise`, L-22);
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

/** `inclusive_tax_paise`: the tax inside an amount, half-up to the rupee, never above it. */
function inclusiveTaxPaise(amountPaise: number, rateBp: number): number {
  if (rateBp === 0 || amountPaise === 0) return 0;
  const unit = PAISE_PER_RUPEE * (BP + rateBp);
  const rupees = Math.floor((amountPaise * rateBp + Math.floor(unit / 2)) / unit);
  return Math.min(rupees * PAISE_PER_RUPEE, amountPaise);
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
    const inside = inclusiveTaxPaise(basePaise, rateBp) / PAISE_PER_RUPEE;
    return { base, tax: inside, isInclusive: true, total: base };
  }
  const amount = roundTaxPaise(basePaise, rateBp) / PAISE_PER_RUPEE;
  return { base, tax: amount, isInclusive: false, total: base + amount };
}

/** True when a rate may tax a service line (`applies_to` service or all). */
function appliesToServices(rate: Pick<ServiceTaxRate, 'appliesTo'>): boolean {
  return rate.appliesTo === 'service' || rate.appliesTo === 'all';
}

/**
 * The rate a service's receipt line is actually taxed with: its own rate
 * while that is switched on and applies to services, else none (exempt).
 * `rate` is `null` when the service has none or the rate is gone (deleted).
 */
export function chargedServiceRate(rate: ServiceTaxRate | null): ServiceTaxRate | null {
  return rate !== null && rate.isActive && appliesToServices(rate) ? rate : null;
}

/** Rates a hospital may attach to a service (active, for services or everything). */
export function serviceTaxOptions(rates: readonly ServiceTaxRate[]): readonly ServiceTaxRate[] {
  return rates.filter((r) => r.isActive && appliesToServices(r));
}

/** Derived availability of a coupon at a given instant. */
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

/**
 * A coupon's state at the instant `now`, against its validity instants the way
 * the backend checks them (`valid_from <= now < valid_to`). Instants need no
 * calendar day, so the PC's date and zone cannot shift it (D-09, UAT-47).
 */
export function couponState(coupon: HospitalCoupon, now: number): CouponState {
  if (!coupon.isActive) return 'Paused';
  if (coupon.usageCap !== null && coupon.usedCount >= coupon.usageCap) return 'Exhausted';
  if (Date.parse(coupon.validTo) <= now) return 'Expired';
  if (Date.parse(coupon.validFrom) > now) return 'Scheduled';
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

/** What a coupon needs to know about a doctor: their department and consultation fee. */
export interface CouponDoctor {
  readonly departmentId: string;
  readonly feePaise: number;
}

/**
 * The cheapest consultation a coupon can be redeemed on, in rupees — the
 * discount base of an app booking (`fees.quote`: consultation, no service;
 * decision 7: no desk coupons). No departments = every department; `null`
 * when no doctor is in scope. A flat coupon above it simply stops at the fee.
 */
export function cheapestConsultationRupees(
  doctors: readonly CouponDoctor[],
  departmentIds: readonly string[],
): number | null {
  const scoped =
    departmentIds.length === 0
      ? doctors
      : doctors.filter((d) => departmentIds.includes(d.departmentId));
  if (scoped.length === 0) return null;
  return Math.min(...scoped.map((d) => d.feePaise)) / PAISE_PER_RUPEE;
}
