/**
 * Services & Pricing entities from the hospital API. Plain readonly types.
 * Money is whole rupees and rates are percentage points here; the paise and
 * basis points the API uses never leave the infrastructure layer.
 */

/** One priced, bookable service in the hospital's catalogue. */
export interface PricedService {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** H1 department id, or `null` for a hospital-wide service. */
  readonly departmentId: string | null;
  readonly description: string;
  readonly durationMinutes: number;
  /** Price before tax, whole rupees. */
  readonly priceRupees: number;
  /** The one tax this service is billed with; `null` = exempt. */
  readonly taxRateId: string | null;
  readonly isActive: boolean;
  readonly version: number;
}

/** What a tax rate may be applied to (`convenience_fee` belongs to the platform). */
export type TaxAppliesTo = 'consultation' | 'service' | 'convenience_fee' | 'all';

export interface ServiceTaxRate {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Percentage points, e.g. 18 for 18%. */
  readonly percent: number;
  /** Already inside the price (receipt breaks it out) rather than added on top. */
  readonly isInclusive: boolean;
  readonly appliesTo: TaxAppliesTo;
  readonly isActive: boolean;
  /** Set by Medibook for every hospital — read-only here. */
  readonly isPlatformDefault: boolean;
  readonly version: number;
}

export type CouponKind = 'percent' | 'flat';

export interface HospitalCoupon {
  readonly id: string;
  /** Upper-case, no spaces. */
  readonly code: string;
  readonly kind: CouponKind;
  /** Percentage points for `percent`; whole rupees for `flat`. */
  readonly value: number;
  /** Validity window as instants (ISO date-time). */
  readonly validFrom: string;
  readonly validTo: string;
  /** Total redemptions allowed; `null` = unlimited. */
  readonly usageCap: number | null;
  readonly usedCount: number;
  /** Minimum order value in whole rupees. */
  readonly minOrderRupees: number;
  /** Most a percent coupon takes off one booking, in rupees; `null` = no cap. */
  readonly maxDiscountRupees: number | null;
  /** Department scope (empty = every department). */
  readonly departmentIds: readonly string[];
  /** Service scope (empty = every service). */
  readonly serviceIds: readonly string[];
  readonly isActive: boolean;
  readonly version: number;
}

export interface ServiceInput {
  readonly name: string;
  readonly departmentId: string | null;
  readonly description: string;
  readonly durationMinutes: number;
  readonly priceRupees: number;
  readonly taxRateId: string | null;
  readonly isActive: boolean;
}

export interface TaxRateInput {
  readonly name: string;
  readonly percent: number;
  readonly isInclusive: boolean;
  readonly appliesTo: TaxAppliesTo;
  readonly isActive: boolean;
}

export interface CouponInput {
  readonly code: string;
  readonly kind: CouponKind;
  readonly value: number;
  readonly validFrom: string;
  readonly validTo: string;
  readonly usageCap: number | null;
  readonly minOrderRupees: number;
  readonly departmentIds: readonly string[];
  readonly serviceIds: readonly string[];
  readonly isActive: boolean;
}
