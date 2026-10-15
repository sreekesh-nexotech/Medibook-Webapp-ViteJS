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
  /** Booked with a doctor (their slot), rather than as a standalone test. */
  readonly requiresDoctor: boolean;
  readonly isActive: boolean;
  readonly version: number;
}

/** A doctor who offers a service, optionally at their own price. */
export interface DoctorServiceLink {
  readonly id: string;
  readonly doctorId: string;
  readonly serviceId: string;
  /** Whole rupees; `null` = the service's own price. */
  readonly priceOverrideRupees: number | null;
}

/** Link a doctor to a service (`POST /doctor-services`). */
export interface DoctorServiceLinkInput {
  readonly doctorId: string;
  readonly serviceId: string;
  /** Whole rupees; `null` = the service's own price. */
  readonly priceOverrideRupees: number | null;
}

/** One booking a coupon was used on. */
export interface CouponRedemption {
  readonly id: string;
  readonly appointmentId: string;
  readonly bookingRef: string;
  /** Whole rupees (may carry paise). */
  readonly discountRupees: number;
  readonly redeemedAt: string;
  /** Set when the booking was cancelled and the use given back. */
  readonly reversedAt: string | null;
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
  /**
   * Live services of this hospital billed with the rate (BE-10); `null` from
   * a backend that does not count them.
   */
  readonly servicesCount: number | null;
  readonly version: number;
}

/**
 * Why a tax rate could not be deleted, switched off or narrowed: services
 * still bill with it (409 `TAX_RATE_IN_USE`, BE-10).
 */
export interface TaxRateInUse {
  readonly serviceCount: number;
  /** Up to 50 of them, by name. */
  readonly serviceNames: readonly string[];
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
  /** Uses allowed per patient; `null` = unlimited. */
  readonly perUserCap: number | null;
  readonly usedCount: number;
  /** Ceiling on a percent discount, whole rupees; `null` = none. */
  readonly maxDiscountRupees: number | null;
  /** Minimum order value in whole rupees. */
  readonly minOrderRupees: number;
  /** Department scope (empty = every department). */
  readonly departmentIds: readonly string[];
  /**
   * Service limits left from before decision 7 — never applied (coupons are
   * department-scoped only, BE-25); saving the coupon drops them.
   */
  readonly legacyServiceIds: readonly string[];
  readonly isActive: boolean;
  readonly version: number;
}

export interface ServiceInput {
  /**
   * A short code of the admin's own; empty = keep the stored one (or, on
   * create, let the server make one from the name — UAT-49, BE-33).
   */
  readonly code?: string;
  readonly name: string;
  readonly departmentId: string | null;
  readonly description: string;
  readonly durationMinutes: number;
  readonly priceRupees: number;
  /**
   * `undefined` leaves the stored rate as it is — the backend refuses to
   * (re)save a rate that has since been switched off.
   */
  readonly taxRateId?: string | null;
  readonly requiresDoctor: boolean;
  readonly isActive: boolean;
}

export interface TaxRateInput {
  /** Empty = keep / let the server make one (UAT-49, BE-33). */
  readonly code?: string;
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
  readonly perUserCap: number | null;
  readonly maxDiscountRupees: number | null;
  readonly minOrderRupees: number;
  /** Coupons are limited to departments only (decision 7). */
  readonly departmentIds: readonly string[];
  readonly isActive: boolean;
}
