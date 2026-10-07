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

/** A ceiling the backend enforces by refusing (`hard_limits`); the others only warn. */
export type PlanHardLimit = 'users' | 'doctors' | 'storage';

/** Which `hard_limits` entry each ceiling is. */
export const HARD_LIMIT_OF: Readonly<Record<CatalogLimitKey, PlanHardLimit>> = {
  staff: 'users',
  doctors: 'doctors',
  storageGb: 'storage',
};

/** Subscription states a plan's subscriber can be in (`HospitalSubscription.Status`). */
export type PlanSubscriberStatus =
  'trialing' | 'active' | 'past_due' | 'grace' | 'read_only' | 'cancelled';

/** The states that count as "on this plan" (cancelled subscriptions do not, 11·F20). */
export const LIVE_SUBSCRIBER_STATUSES: readonly PlanSubscriberStatus[] = [
  'trialing',
  'active',
  'past_due',
  'grace',
  'read_only',
];

/** One hospital subscribed to a plan (`GET /platform/plans/{id}/subscribers`). */
export interface PlanSubscriber {
  /** The subscription's id. */
  readonly id: string;
  readonly hospitalId: string;
  readonly hospitalName: string;
  /** A status this build may not know is kept as sent. */
  readonly status: string;
  readonly billingPeriod: string;
  readonly startedAt: string | null;
  readonly trialEndsAt: string | null;
  readonly nextInvoiceAt: string | null;
}

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
  /** Ceilings enforced by refusing; the rest warn only. */
  readonly hardLimits: readonly PlanHardLimit[];
  /** GST on the plan charge, basis points (1800 = 18%). */
  readonly gstRateBp: number;
  /** Free days before the first invoice; 0 = billed from day one. */
  readonly trialDays: number;
  /** Catalog position, lowest first. */
  readonly sortOrder: number;
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
  readonly hardLimits: readonly PlanHardLimit[];
  readonly gstRateBp: number;
  readonly trialDays: number;
  readonly sortOrder: number;
  readonly isPublic: boolean;
}
