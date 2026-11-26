import { addDaysISO, calendarDate, calendarInstant } from '@/shared/lib/format';

import type {
  CouponState,
  PlatformCoupon,
} from '@/features/ops-coupons/domain/entities/coupons.entities';

/** A percent coupon is at most 100% (the backend's 10 000 bp). */
export const MAX_PERCENT = 100;
/** Shortest usable code, e.g. "MB20". */
export const MIN_CODE_LENGTH = 4;
const PAISE_PER_RUPEE = 100;
const BP_PER_PERCENT = 100;
const BP = 10_000;
const ONE_MS = 1;

/** Codes are stored upper-case with no spaces. */
export function normaliseCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, '');
}

/** A coupon's state at `now`, the way the backend checks it (`valid_from <= now < valid_to`). */
export function couponState(c: PlatformCoupon, now: number): CouponState {
  if (!c.isActive) return 'Paused';
  if (c.usageCap !== null && c.usedCount >= c.usageCap) return 'Used up';
  if (Date.parse(c.validTo) <= now) return 'Expired';
  if (Date.parse(c.validFrom) > now) return 'Scheduled';
  return 'Active';
}

/** "₹100 off" / "10% off (up to ₹200)". */
export function discountLabel(c: Pick<PlatformCoupon, 'kind' | 'value' | 'maxDiscountRupees'>) {
  if (c.kind === 'flat') return `₹${c.value.toLocaleString('en-IN')} off`;
  const cap =
    c.maxDiscountRupees === null ? '' : ` (up to ₹${c.maxDiscountRupees.toLocaleString('en-IN')})`;
  return `${c.value}% off${cap}`;
}

/**
 * Discount on a consultation of `orderRupees`, worked out in paise as the bill is (backend
 * `fees.quote`, `money.apply_bp` half-up): a percent coupon stops at its cap, nothing takes more
 * than the order, and nothing applies below the minimum order.
 */
export function discountOn(
  c: Pick<PlatformCoupon, 'kind' | 'value' | 'minOrderRupees' | 'maxDiscountRupees'>,
  orderRupees: number,
): number {
  const order = Math.round(orderRupees * PAISE_PER_RUPEE);
  if (order < Math.round(c.minOrderRupees * PAISE_PER_RUPEE)) return 0;
  let discount: number;
  if (c.kind === 'percent') {
    const bp = Math.round(Math.min(c.value, MAX_PERCENT) * BP_PER_PERCENT);
    const unit = PAISE_PER_RUPEE * BP;
    // apply_bp: half-up to the rupee, in paise
    discount = Math.floor((order * bp + unit / 2) / unit) * PAISE_PER_RUPEE;
    if (c.maxDiscountRupees !== null) {
      discount = Math.min(discount, Math.round(c.maxDiscountRupees * PAISE_PER_RUPEE));
    }
  } else {
    discount = Math.round(c.value * PAISE_PER_RUPEE);
  }
  return Math.max(0, Math.min(discount, order)) / PAISE_PER_RUPEE;
}

/** ISO instant → the calendar day it falls on (`yyyy-mm-dd`). */
export function dayOf(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? '' : calendarDate(t);
}

/** The last day a coupon is valid on (`valid_to` is an exclusive instant). */
export function lastDayOf(validTo: string): string {
  const t = Date.parse(validTo);
  return Number.isNaN(t) ? '' : calendarDate(t - ONE_MS);
}

/** `yyyy-mm-dd` → the instant that day starts. */
export function dayStart(day: string): string {
  return calendarInstant(day);
}

/** `yyyy-mm-dd` → the exclusive end of that day (the next midnight). */
export function dayEndExclusive(day: string): string {
  return calendarInstant(addDaysISO(day, 1));
}

/** Backend `value` ↔ form units: percent coupons in basis points, flat ones in paise. */
export function fromApiValue(kind: PlatformCoupon['kind'], value: number): number {
  return kind === 'percent' ? value / BP_PER_PERCENT : value / PAISE_PER_RUPEE;
}

export function toApiValue(kind: PlatformCoupon['kind'], value: number): number {
  return Math.round(kind === 'percent' ? value * BP_PER_PERCENT : value * PAISE_PER_RUPEE);
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * PAISE_PER_RUPEE);
}

export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}
