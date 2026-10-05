/**
 * Platform hospital-registry entities, as `/platform/hospitals` serves them.
 * Plain readonly types.
 */

/** Lifecycle status of a hospital instance (backend `Hospital.Status`). */
export type HospitalLifecycle = 'draft' | 'onboarding' | 'active' | 'suspended' | 'closed';

/** Why a hospital was suspended (backend `HospitalSuspension.Reason`). */
export type HospitalSuspensionReason =
  'non_payment' | 'non_payment_read_only' | 'compliance' | 'manual' | 'onboarding_rejected';

/** The reasons an operator may pick by hand (`non_payment_read_only` is set by dunning only). */
export type HospitalSuspendReason = Exclude<HospitalSuspensionReason, 'non_payment_read_only'>;

/** Onboarding-case stage (backend `OnboardingCase.Stage`). */
export type HospitalOnboardingStage =
  'application' | 'documents_pending' | 'review' | 'approved' | 'live' | 'rejected';

/** Plan-limited usage metrics (backend `limits.METRICS`). */
export type HospitalUsageMetric = 'users' | 'doctors' | 'storage';

/** One hospital row in the platform registry. */
export interface PlatformHospital {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly legalName: string | null;
  readonly gstin: string | null;
  readonly registrationNo: string | null;
  readonly email: string;
  /** E.164, e.g. `+919822044315`. */
  readonly phone: string;
  readonly city: string;
  readonly state: string;
  readonly status: HospitalLifecycle;
  /** ISO timestamp the instance went live, or `null` while onboarding. */
  readonly goLiveAt: string | null;
  readonly createdAt: string;
  readonly version: number;
}

/** Current plan subscription of a hospital. */
export interface HospitalSubscription {
  readonly id: string;
  readonly planId: string;
  readonly planCode: string;
  readonly status: string;
  readonly billingPeriod: string;
  readonly trialEndsAt: string | null;
  readonly currentPeriodEnd: string | null;
}

/** Usage of one plan-limited metric; `limit` `null` = unlimited. Storage is in bytes. */
export interface HospitalUsageMeter {
  readonly current: number;
  readonly limit: number | null;
  /** The limit is enforced (writes refused at the cap). */
  readonly hard: boolean;
}

export interface HospitalActiveSuspension {
  readonly id: string;
  readonly reason: HospitalSuspensionReason;
  readonly suspendedAt: string;
}

/** One reason the instance cannot go live yet. */
export interface HospitalGoLiveBlocker {
  readonly code: string;
  /** Open checklist items or missing numbering series, when the blocker names any. */
  readonly details: readonly string[];
}

/** The full platform profile of one hospital (`GET /platform/hospitals/{id}`). */
export interface PlatformHospitalDetail extends PlatformHospital {
  readonly subscription: HospitalSubscription | null;
  readonly usage: Readonly<Partial<Record<HospitalUsageMetric, HospitalUsageMeter>>>;
  readonly onboarding: { readonly id: string; readonly stage: HospitalOnboardingStage } | null;
  readonly staffCount: number;
  readonly activeSuspensions: readonly HospitalActiveSuspension[];
  readonly goLiveBlockers: readonly HospitalGoLiveBlocker[];
}

/** Server-side list query: 1-based page, search, filters and sort. */
export interface HospitalListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly q: string;
  readonly statuses: readonly HospitalLifecycle[];
  readonly planId: string | null;
  /** Backend sort expression, e.g. `name` or `-created_at`; `null` = server default. */
  readonly sort: string | null;
}

/** Registry totals for the KPI row. */
export interface HospitalStatusCounts {
  readonly total: number;
  readonly active: number;
  /** `draft` + `onboarding`. */
  readonly pending: number;
  readonly suspended: number;
}

/** How the per-booking convenience fee is charged: paise, or basis points. */
export type ConvenienceFeeKind = 'flat' | 'percent';

export type HospitalBillingPeriod = 'monthly' | 'yearly';

/** One numbering series chosen at onboarding: tokens `{PREFIX} {SEQ:n} {FY} {YY} {YYYY} {MM}`. */
export interface NumberingSpecInput {
  readonly format: string;
  readonly prefix: string;
}

/** Everything `POST /platform/hospitals` needs to provision a new instance. */
export interface HospitalCreateInput {
  readonly slug: string;
  readonly name: string;
  readonly email: string;
  /** E.164, e.g. `+919876543210`. */
  readonly phoneE164: string;
  readonly addressLine1: string;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  /** Platform commission on online bookings, in basis points. */
  readonly commissionBp: number;
  readonly convenienceFeeKind: ConvenienceFeeKind;
  /** Paise when `flat`, basis points when `percent`. */
  readonly convenienceFeeValue: number;
  readonly numbering: {
    readonly mrn: NumberingSpecInput;
    readonly booking: NumberingSpecInput;
    readonly receipt: NumberingSpecInput;
  };
  readonly planId: string;
  readonly billingPeriod: HospitalBillingPeriod;
  /** Invited as the hospital's first administrator. */
  readonly firstAdmin: {
    readonly email: string;
    readonly firstName: string;
    readonly lastName: string | null;
    readonly phoneE164: string | null;
  };
}
