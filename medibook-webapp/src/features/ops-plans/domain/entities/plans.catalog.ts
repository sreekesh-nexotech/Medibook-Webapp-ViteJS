/**
 * Subscription-plan catalog entities, as the platform API serves them
 * (`/platform/plans`, Q101–102). Prices are whole rupees here; the paise
 * conversion stays in infrastructure.
 */

/** One plan ceiling: `null` = unlimited, a number (including 0) = a real cap. */
export type CatalogPlanLimit = number | null;

/** The ceilings the backend stores. Bookings, branches and message credits have no field. */
export const CATALOG_LIMIT_KEYS = ['staff', 'doctors', 'storageGb'] as const;

export type CatalogLimitKey = (typeof CATALOG_LIMIT_KEYS)[number];

export type CatalogPlanLimits = { readonly [K in CatalogLimitKey]: CatalogPlanLimit };

/** One plan tier in the platform catalog. */
export interface CatalogPlan {
  readonly id: string;
  /** Immutable machine code, unique across live plans. */
  readonly code: string;
  readonly name: string;
  /** The card's extra feature line, or `null`. */
  readonly description: string | null;
  /** Monthly list price in ₹, exclusive of GST. */
  readonly priceMonthly: number;
  /** Yearly list price in ₹, or `null` for monthly-only. */
  readonly priceYearly: number | null;
  readonly limits: CatalogPlanLimits;
  /** `true` = standard (public) tier; `false` = hospital-specific. */
  readonly isPublic: boolean;
  /** `false` once archived: no new subscriptions, existing subscribers keep it. */
  readonly isActive: boolean;
  /** Row version for optimistic concurrency (`If-Match`). */
  readonly version: number;
}

/** What the plan form submits, for both create and edit. */
export interface CatalogPlanDraft {
  readonly name: string;
  readonly description: string | null;
  readonly priceMonthly: number;
  readonly priceYearly: number | null;
  readonly limits: CatalogPlanLimits;
  readonly isPublic: boolean;
}
