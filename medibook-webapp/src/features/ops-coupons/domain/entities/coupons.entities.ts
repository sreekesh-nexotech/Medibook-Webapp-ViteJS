/**
 * Medibook Operations' coupons (client feedback point 9): platform-wide offer codes that Medibook
 * pays for — the hospital is credited the discount, so it still receives its full fee. Patients
 * learn of an offer from a home-screen banner (Ops › Notifications) and type the code when they
 * book in the app. One coupon per booking; online bookings only; every hospital.
 */

export type CouponKind = 'percent' | 'flat';

/** Derived availability at a given instant. */
export type CouponState = 'Active' | 'Scheduled' | 'Expired' | 'Used up' | 'Paused';

export interface PlatformCoupon {
  readonly id: string;
  /** Upper-case, no spaces, e.g. `FIRST100`. */
  readonly code: string;
  readonly kind: CouponKind;
  /** Whole percent for `percent` (10 = 10%); rupees for `flat`. */
  readonly value: number;
  /** Percent coupons only; `null` = no ceiling. */
  readonly maxDiscountRupees: number | null;
  readonly minOrderRupees: number;
  /** ISO instants; valid while `validFrom <= now < validTo`. */
  readonly validFrom: string;
  readonly validTo: string;
  /** `null` = unlimited. */
  readonly usageCap: number | null;
  readonly perUserCap: number | null;
  readonly usedCount: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly version: number;
}

/** What the create / edit form sends. */
export interface PlatformCouponInput {
  readonly code: string;
  readonly kind: CouponKind;
  readonly value: number;
  readonly maxDiscountRupees: number | null;
  readonly minOrderRupees: number;
  readonly validFrom: string;
  readonly validTo: string;
  readonly usageCap: number | null;
  readonly perUserCap: number | null;
  readonly isActive: boolean;
}

/** One booking that used a Medibook coupon — the booking ref, never the patient. */
export interface PlatformCouponUse {
  readonly id: string;
  readonly hospitalName: string;
  readonly bookingRef: string;
  /** The discount Medibook bore. */
  readonly discountRupees: number;
  readonly redeemedAt: string;
  /** Set when an unpaid booking gave the use back. */
  readonly reversedAt: string | null;
}
