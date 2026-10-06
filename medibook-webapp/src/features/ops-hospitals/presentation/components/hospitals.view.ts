import { money } from '@/shared/lib/format';

import type {
  ConvenienceFeeKind,
  HospitalLifecycle,
  HospitalOnboardingStage,
  HospitalSuspensionReason,
  PlatformHospital,
} from '@/features/ops-hospitals/domain/entities/hospitals.entity';

/**
 * Display mapping for the registry screens — backend codes to the console's
 * badge statuses and wording. Badge statuses must be keys of
 * `shared/ui/status-map`.
 */

/** Lifecycle → [badge status, label]. `draft` and `onboarding` both read as pending. */
export const HOSPITAL_STATUS_VIEW: Readonly<Record<HospitalLifecycle, readonly [string, string]>> =
  {
    draft: ['Pending verification', 'Pending verification'],
    onboarding: ['Pending verification', 'Pending verification'],
    active: ['Active', 'Active'],
    suspended: ['Suspended', 'Suspended'],
    closed: ['Inactive', 'Closed'],
  };

/** Status filter options → the lifecycle values each one sends. */
export const HOSPITAL_STATUS_FILTER: Readonly<Record<string, readonly HospitalLifecycle[]>> = {
  Active: ['active'],
  'Pending verification': ['draft', 'onboarding'],
  Suspended: ['suspended'],
  Closed: ['closed'],
};

export const HOSPITAL_PENDING_STATUSES: readonly HospitalLifecycle[] = ['draft', 'onboarding'];

export function isHospitalPending(status: HospitalLifecycle): boolean {
  return HOSPITAL_PENDING_STATUSES.includes(status);
}

export const SUSPENSION_REASON_LABEL: Readonly<Record<HospitalSuspensionReason, string>> = {
  non_payment: 'Non-payment',
  non_payment_read_only: 'Non-payment (read-only)',
  compliance: 'Compliance',
  manual: 'Manual review',
  onboarding_rejected: 'Onboarding rejected',
};

/** Onboarding stage → [badge status, label]. */
export const ONBOARDING_STAGE_VIEW: Readonly<
  Record<HospitalOnboardingStage, readonly [string, string]>
> = {
  application: ['Pending', 'Application'],
  documents_pending: ['Requested', 'Documents pending'],
  review: ['Submitted', 'In review'],
  approved: ['Verified', 'Approved'],
  live: ['Live', 'Live'],
  rejected: ['Rejected', 'Rejected'],
};

/** Go-live blocker code → sentence (backend `platform_hospitals.go_live_blockers`). */
export const GO_LIVE_BLOCKER_LABEL: Readonly<Record<string, string>> = {
  checklist_incomplete: 'Onboarding checklist items are still open.',
  no_admin_accepted: 'No hospital administrator has accepted their invitation yet.',
  no_bank_account: 'No payout bank account has been added.',
  no_subscription: 'There is no active or trial subscription.',
  numbering_not_confirmed: 'Numbering formats are not confirmed.',
};

export const GO_LIVE_BLOCKER_FALLBACK = 'Something is still blocking go-live.';

/** Detail-page href for a registry hospital (the route is `hospitals/:id`). */
export function hospitalDetailHref(hospitalsPath: string, id: string): string {
  return `${hospitalsPath}/${encodeURIComponent(id)}`;
}

/* -------------------------------------------------- commission and fees */

/** Basis points and paise are both hundredths of the unit a person types. */
const HUNDREDTHS = 100;

/** 450 → "4.5%"; 0 → "0%". */
export function bpCopy(bp: number): string {
  return `${(bp / HUNDREDTHS).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`;
}

/** The patient's convenience fee as it reads: "₹ 20 per booking" or "3% of the consultation fee". */
export function convenienceFeeCopy(kind: ConvenienceFeeKind, value: number): string {
  return kind === 'flat'
    ? `${money(value / HUNDREDTHS)} per booking`
    : `${bpCopy(value)} of the consultation fee`;
}

/** Paise or basis points as the number a person edits: 2000 → "20", 450 → "4.5". */
export function hundredthsInput(value: number): string {
  return (value / HUNDREDTHS).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

/* ------------------------------------------------------ patient access */

const NOT_LIVE_REASON: Readonly<Record<HospitalLifecycle, string | null>> = {
  draft: 'It has not gone live yet.',
  onboarding: 'It has not gone live yet.',
  active: null,
  suspended: 'It is suspended.',
  closed: 'It is closed.',
};

/**
 * Why patients cannot book the hospital online — empty when they can. The
 * backend takes an online booking only from an active hospital that is listed
 * in the app and has online booking on (`booking._bookable_hospital`).
 */
export function bookabilityGaps(h: PlatformHospital): readonly string[] {
  const gaps: string[] = [];
  const notLive = NOT_LIVE_REASON[h.status];
  if (notLive) gaps.push(notLive);
  if (h.appVisibility !== 'visible') gaps.push('It is hidden from the patient app.');
  if (!h.onlineBookingEnabled) gaps.push('Online booking is switched off.');
  return gaps;
}
