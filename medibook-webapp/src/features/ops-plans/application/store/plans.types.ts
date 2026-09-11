/**
 * Subscription-plan view-model types (interim entities for the static-seed
 * phase). Shapes transcribed from the design prototype's `OpsDB.plans` and
 * `OpsDB.planChanges` (Ops.jsx), then extended for audit SA-02: "Plans are
 * monthly only and limited by bookings and staff. Yearly plans, and limits on
 * doctors, branches, storage and message credits, have no field."
 */

/**
 * One plan ceiling. `null` means **unlimited**; a number is a real cap — so a
 * plan that allows `0` doctors is a different plan from one with no doctor
 * ceiling at all. Collapsing the two into a single number (0 = unlimited) is
 * the modelling bug SA-02 calls out, which is why unlimited is its own value
 * that no arithmetic can produce by accident.
 */
export type PlanLimit = number | null;

/** Every dimension a plan caps. `null` on any of them = unlimited. */
export interface PlanLimits {
  /** Medibook bookings included per billing period. */
  readonly bookings: PlanLimit;
  /** Staff accounts (receptionists, admins) the hospital may create. */
  readonly staff: PlanLimit;
  /** Doctor profiles the hospital may publish. */
  readonly doctors: PlanLimit;
  /** Branches / locations the tenant may run under one instance. */
  readonly branches: PlanLimit;
  /** Document + report storage ceiling, in whole GB. */
  readonly storageGb: PlanLimit;
  /** Prepaid SMS / WhatsApp credits per billing period. */
  readonly messageCredits: PlanLimit;
}

/** The dimensions in the order they are shown on cards and in the modal. */
export const PLAN_LIMIT_KEYS = [
  'bookings',
  'staff',
  'doctors',
  'branches',
  'storageGb',
  'messageCredits',
] as const;

export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number];

/** Cadences a plan may be billed on. Monthly always exists; yearly is opt-in. */
export type BillingPeriod = 'Monthly' | 'Yearly';

/** One subscription plan tier in the platform catalog. */
export interface Plan {
  readonly id: number;
  readonly name: string;
  /** Monthly list price in ₹, exclusive of the 18% GST added at invoicing. */
  readonly price: number;
  /**
   * Yearly list price in ₹ when the plan may also be billed yearly, or `null`
   * for monthly-only. Never derived from `price` — ops negotiates the yearly
   * discount, the UI only *shows* the discount it implies.
   */
  readonly yearlyPrice: number | null;
  /** Per-dimension ceilings — the single source of truth for what a plan allows. */
  readonly limits: PlanLimits;
  /**
   * @deprecated Numeric mirror of `limits.bookings`, kept only because the
   * hospital-side Plan & Billing card still reads a plain number. Unlimited
   * bookings mirror as `Infinity`, so a quota bar reads "of ∞ / month" at 0%
   * instead of dividing by zero. New code reads `limits.bookings`.
   */
  readonly quota: number;
  readonly support: string;
  readonly extra: string;
  readonly popular: boolean;
  readonly custom: boolean;
}

/** Lifecycle state of a hospital's plan-change request. */
export type PlanChangeStatus = 'Completed' | 'Pending' | 'Cancelled';

/** A hospital's request to move between plan tiers. */
export interface PlanChange {
  readonly id: number;
  /** Tenant id in the ops hospital registry (joined on id, never on name). */
  readonly hid: number;
  readonly hospital: string;
  readonly email: string;
  readonly change: string;
  readonly requested: string;
  readonly status: PlanChangeStatus;
}
