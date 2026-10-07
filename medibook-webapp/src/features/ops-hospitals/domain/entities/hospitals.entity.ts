/**
 * Platform hospital-registry entities, as `/platform/hospitals` serves them.
 * Plain readonly types.
 */

/** Lifecycle status of a hospital instance (backend `Hospital.Status`). */
export type HospitalLifecycle = 'draft' | 'onboarding' | 'active' | 'suspended' | 'closed';

/** Why a hospital was suspended (backend `HospitalSuspension.Reason`). */
export type HospitalSuspensionReason =
  'non_payment' | 'non_payment_read_only' | 'compliance' | 'manual' | 'onboarding_rejected';

/**
 * The reasons an operator may pick by hand (`PlatformHospitalSuspendSerializer`):
 * `non_payment_read_only` is set by dunning only and `onboarding_rejected` by
 * rejecting the onboarding case (decision 9).
 */
export type HospitalSuspendReason = 'non_payment' | 'compliance' | 'manual';

/** Onboarding-case stage (backend `OnboardingCase.Stage`). */
export type HospitalOnboardingStage =
  'application' | 'documents_pending' | 'review' | 'approved' | 'live' | 'rejected';

/** Whether the hospital is listed in the patient app (Q67). */
export type HospitalAppVisibility = 'visible' | 'hidden';

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
  readonly website: string | null;
  readonly addressLine1: string;
  readonly addressLine2: string | null;
  readonly addressLine3: string | null;
  readonly city: string;
  readonly state: string;
  readonly pincode: string;
  readonly status: HospitalLifecycle;
  /** Listed in the patient app. A hospital is bookable online only when it is active, visible and has online booking on. */
  readonly appVisibility: HospitalAppVisibility;
  readonly onlineBookingEnabled: boolean;
  /** Platform commission on online bookings, in basis points (450 = 4.5%). */
  readonly commissionBp: number;
  readonly convenienceFeeKind: ConvenienceFeeKind;
  /** Paise when the fee is flat; basis points when it is a percentage. */
  readonly convenienceFeeValue: number;
  /** ISO timestamp the instance went live, or `null` while onboarding. */
  readonly goLiveAt: string | null;
  /** IANA zone the hospital works in (`Asia/Kolkata`); `null` when the server does not say. */
  readonly timezone: string | null;
  readonly createdAt: string;
  readonly version: number;
  /*
   * Registry extras (BE-29). `null` when the server sends none — an older
   * backend, or a hospital without a subscription / case / suspension.
   */
  readonly planName: string | null;
  readonly planCode: string | null;
  readonly subscriptionStatus: string | null;
  /** Live bookings in the last 30 days. */
  readonly bookings30d: number | null;
  readonly onboardingStage: HospitalOnboardingStage | null;
  /** The newest active suspension's reason (e.g. `onboarding_rejected`). */
  readonly suspensionReason: HospitalSuspensionReason | null;
}

/** Current plan subscription of a hospital. */
export interface HospitalSubscription {
  readonly id: string;
  readonly planId: string;
  readonly planCode: string | null;
  readonly planName: string | null;
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
  /** The operator's note, when one was recorded. */
  readonly note: string | null;
  readonly suspendedAt: string;
}

/** One reason the instance cannot go live yet. */
export interface HospitalGoLiveBlocker {
  readonly code: string;
  /** Open checklist items or missing numbering series, when the blocker names any. */
  readonly details: readonly string[];
}

/** Status of the first administrator's invitation (`HospitalAdminInvitation.Status`). */
export type FirstAdminInvitationStatus = 'invited' | 'accepted' | 'expired' | 'revoked';

/** The first administrator's invitation as ops sees it (CORE-04). */
export interface FirstAdminInvitation {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string | null;
  /** `invited` past its expiry reads as `expired`. Unknown values are kept as sent. */
  readonly status: FirstAdminInvitationStatus | string;
  readonly invitedAt: string;
  readonly lastSentAt: string;
  readonly expiresAt: string;
  readonly resendCount: number;
  readonly maxResends: number;
  readonly acceptedAt: string | null;
  /** Some administrator has accepted (this invitation or another). */
  readonly adminAccepted: boolean;
  readonly canResend: boolean;
}

/** Re-issue the first-admin invitation, optionally to corrected details. */
export interface FirstAdminResend {
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string | null;
}

/** A hospital payout account as the platform sees it — never the full number. */
export interface HospitalBankAccount {
  readonly id: string;
  readonly accountHolder: string;
  readonly bankName: string;
  readonly ifsc: string;
  readonly accountNumberMasked: string;
  readonly upiIdMasked: string | null;
  readonly isPrimary: boolean;
  /** Set once platform finance verified it (M-45); unverified primaries are skipped by payouts. */
  readonly verifiedAt: string | null;
  readonly createdAt: string;
}

/** The full platform profile of one hospital (`GET /platform/hospitals/{id}`). */
export interface PlatformHospitalDetail extends PlatformHospital {
  readonly subscription: HospitalSubscription | null;
  readonly usage: Readonly<Partial<Record<HospitalUsageMetric, HospitalUsageMeter>>>;
  readonly onboarding: {
    readonly id: string;
    readonly stage: HospitalOnboardingStage;
    readonly rejectionReason: string | null;
  } | null;
  readonly staffCount: number;
  readonly activeSuspensions: readonly HospitalActiveSuspension[];
  readonly goLiveBlockers: readonly HospitalGoLiveBlocker[];
  /** `null` when never invited, or when the server does not report it. */
  readonly firstAdminInvitation: FirstAdminInvitation | null;
  /** Masked payout accounts; `null` when the server does not report them. */
  readonly bankAccounts: readonly HospitalBankAccount[] | null;
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
  /** E.164, e.g. `+919876543210` or a landline `+914842701000`. */
  readonly phoneE164: string;
  /** IANA zone the hospital works in; omitted = the server default. */
  readonly timezone?: string;
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

/** Profile fields ops may correct after onboarding (`PatchedPlatformHospitalProfileRequest`). */
export interface HospitalProfileChanges {
  readonly name?: string;
  readonly legalName?: string | null;
  readonly gstin?: string | null;
  readonly registrationNo?: string | null;
  readonly email?: string;
  /** E.164, e.g. `+914842701000`. */
  readonly phone?: string;
  readonly website?: string | null;
  readonly addressLine1?: string;
  readonly addressLine2?: string | null;
  readonly city?: string;
  readonly state?: string;
  readonly pincode?: string;
  /** Fixed once the hospital is live (L-20). */
  readonly timezone?: string;
  readonly onlineBookingEnabled?: boolean;
}

/** A new platform commission rate and the day it takes effect (hospital-local). */
export interface HospitalCommissionChange {
  readonly commissionBp: number;
  /** ISO date; today or later. */
  readonly effectiveFrom: string;
  readonly note: string | null;
}

/** A new convenience fee for future bookings. */
export interface HospitalConvenienceFeeChange {
  readonly kind: ConvenienceFeeKind;
  /** Paise when flat; basis points (0–10000) when percent. */
  readonly value: number;
}

/** One commission rate in the hospital's history (API-01, Q9). */
export interface CommissionRate {
  readonly id: string;
  readonly commissionBp: number;
  /** ISO date, hospital-local. */
  readonly effectiveFrom: string;
  /** `scheduled` (future-dated), `current` (in force today) or `past`. */
  readonly status: string;
  readonly note: string | null;
  readonly setByName: string | null;
  readonly createdAt: string;
}

/** Every rate set for a hospital, newest `effectiveFrom` first. */
export interface CommissionHistory {
  /** The hospital-local today the statuses were worked out on. */
  readonly today: string | null;
  readonly rates: readonly CommissionRate[];
}

/** A payout account as platform finance verifies it (M-45, decision 4). */
export interface PayoutBankAccount {
  readonly id: string;
  readonly accountHolder: string;
  readonly bankName: string;
  readonly ifsc: string;
  readonly accountNumberMasked: string;
  readonly upiId: string | null;
  readonly isPrimary: boolean;
  readonly verifiedAt: string | null;
  readonly version: number;
}
