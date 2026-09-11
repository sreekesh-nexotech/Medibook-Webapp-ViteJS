/**
 * Services, pricing, taxes and coupons — audit HA-04 (§2.4): "A department
 * carries one base fee. Services, per-service pricing, taxes and coupons have
 * no screen."
 *
 * Money is an **integer in whole rupees**, the unit the web app's `money()`
 * helper formats (CANONICAL_MASTER_DATA §8) — never a string, never paise.
 */

/** One priced, bookable service in the hospital's catalogue. */
export interface HospitalService {
  readonly id: string;
  readonly name: string;
  /** Owning department name, from the Doctors & Departments master data. */
  readonly dept: string;
  /** Chair/room time the service consumes, in minutes. */
  readonly durationMinutes: number;
  readonly description: string;
  /**
   * Service price in whole rupees. Independent of the department base fee —
   * that fee is the consultation, this is the service.
   */
  readonly price: number;
  readonly active: boolean;
}

/** Whether a tax sits on top of the price or is already inside it. */
export const TAX_MODES = ['Exclusive', 'Inclusive'] as const;

export type TaxMode = (typeof TAX_MODES)[number];

/**
 * A configurable tax. The receipt shows tax as its own line
 * (CANONICAL_MASTER_DATA §7), so `Exclusive` is the default and the case that
 * must work; `Inclusive` back-computes the component out of the price.
 */
export interface TaxRate {
  readonly id: string;
  readonly name: string;
  /** Percentage points, e.g. 18 for 18% GST. */
  readonly percent: number;
  readonly mode: TaxMode;
  readonly active: boolean;
}

/** Percent coupons take a share off; flat coupons take rupees off. */
export const COUPON_TYPES = ['Percent', 'Flat'] as const;

export type CouponType = (typeof COUPON_TYPES)[number];

/** A discount code the desk or the patient app may apply. */
export interface Coupon {
  readonly id: string;
  /** Upper-case, no spaces, e.g. `MONSOON20`. */
  readonly code: string;
  readonly type: CouponType;
  /** Percentage points for `Percent`; whole rupees for `Flat`. */
  readonly value: number;
  /** Validity window, ISO `yyyy-mm-dd` (inclusive). */
  readonly from: string;
  readonly to: string;
  /** Total redemptions allowed; 0 means unlimited. */
  readonly usageCap: number;
  /** Redemptions so far. */
  readonly used: number;
  /** Minimum order value in whole rupees before the code applies. */
  readonly minOrder: number;
  /** Service ids the code applies to; empty = every service. */
  readonly serviceIds: readonly string[];
  /** Department names the code applies to; empty = every department. */
  readonly departments: readonly string[];
  readonly active: boolean;
}

/** Derived availability of a coupon on a given day. */
export type CouponState = 'Active' | 'Scheduled' | 'Expired' | 'Exhausted' | 'Paused';

/** One tax line of a priced total. */
export interface TaxLine {
  readonly name: string;
  readonly percent: number;
  readonly mode: TaxMode;
  /** Tax amount in whole rupees. */
  readonly amount: number;
}

/** A fully priced service: what the receipt will show, line by line. */
export interface PriceBreakdown {
  /** Net amount before exclusive tax (inclusive tax is already inside it). */
  readonly base: number;
  readonly taxes: readonly TaxLine[];
  /** Sum of the tax lines. */
  readonly taxTotal: number;
  /** What the patient pays. */
  readonly total: number;
}
