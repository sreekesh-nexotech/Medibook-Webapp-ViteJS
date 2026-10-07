import { money } from '@/shared/lib/format';

import type {
  ConvenienceFeeKind,
  FirstAdminInvitation,
  HospitalLifecycle,
  HospitalOnboardingStage,
  HospitalSuspendReason,
  HospitalSuspensionReason,
  PlatformHospital,
  PlatformHospitalDetail,
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

/** The reasons an operator picks from when suspending (UAT-58), most common first. */
export const SUSPEND_REASON_OPTIONS: readonly HospitalSuspendReason[] = [
  'manual',
  'compliance',
  'non_payment',
];

/**
 * Registry and header badge for a hospital. A rejected application is
 * suspended with reason `onboarding_rejected` (decision 9) and reads as
 * rejected — never as "Pending verification" or a plain suspension (UAT-58).
 */
export function hospitalStatusView(
  h: Pick<PlatformHospital, 'status' | 'suspensionReason' | 'onboardingStage'>,
): readonly [string, string] {
  if (h.suspensionReason === 'onboarding_rejected' || h.onboardingStage === 'rejected') {
    return ['Rejected', 'Application rejected'];
  }
  return HOSPITAL_STATUS_VIEW[h.status];
}

/**
 * What a suspension does, in the confirm dialog. Suspension refuses writes
 * only: staff still sign in and read (decision 9, `subscriptions/services/
 * gate.py`), patients cannot book.
 */
export function suspendCopy(name: string): string {
  return `${name}'s staff can still sign in and view their records, but every change is refused and patients can no longer book appointments there. Existing bookings are kept. Reactivation is a separate action.`;
}

/**
 * What lifting the suspension leads to (UAT-58): a hospital that never went
 * live returns to onboarding; a lapsed subscription stays read-only until its
 * invoice is paid; otherwise patients can book again if it is listed.
 */
export function reactivateCopy(h: PlatformHospitalDetail): string {
  const reasons = h.activeSuspensions.map((s) => s.reason);
  const unpaid =
    reasons.includes('non_payment') ||
    reasons.includes('non_payment_read_only') ||
    h.subscription?.status === 'read_only';
  const payNote = unpaid
    ? ' Its unpaid invoice stays unpaid and the hospital stays read-only until the payment is recorded on the invoice.'
    : '';
  if (h.goLiveAt === null) {
    return `${h.name} returns to onboarding and its staff can make changes again. Patients cannot book it until it goes live.${payNote}`;
  }
  const bookable = h.appVisibility === 'visible' && h.onlineBookingEnabled;
  return `${h.name}'s staff can make changes again${
    bookable
      ? ' and patients can book it right away.'
      : '. Patients still cannot book it online: it is hidden from the app or online booking is off.'
  }${payNote}`;
}

/** A rejected application is lifted by re-opening its onboarding case, not by reactivating. */
export function isRejectedApplication(h: PlatformHospitalDetail): boolean {
  return (
    h.onboarding?.stage === 'rejected' ||
    h.activeSuspensions.some((s) => s.reason === 'onboarding_rejected')
  );
}

/** The first administrator's invitation as one line (CORE-04). */
export function invitationStatusCopy(inv: FirstAdminInvitation): string {
  if (inv.adminAccepted) return 'An administrator has accepted — the hospital can sign in.';
  switch (inv.status) {
    case 'invited':
      return `Invitation sent to ${inv.email}; waiting for them to accept.`;
    case 'expired':
      return `The invitation to ${inv.email} expired before it was accepted. Re-send it.`;
    case 'revoked':
      return `The invitation to ${inv.email} was withdrawn. Re-send it to invite them again.`;
    default:
      return `Invitation to ${inv.email}: ${inv.status}.`;
  }
}

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
  not_approved: 'The onboarding case has not been approved yet.',
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
 * in the app, has online booking on and is not read-only
 * (`booking._bookable_hospital`, D-30).
 */
export function bookabilityGaps(
  h: PlatformHospital,
  subscriptionStatus: string | null = null,
): readonly string[] {
  const gaps: string[] = [];
  const notLive = NOT_LIVE_REASON[h.status];
  if (notLive) gaps.push(notLive);
  // A lapsed subscription hides the hospital from the patient app (D-30, 10·F11).
  if (subscriptionStatus === 'read_only') {
    gaps.push('It is read-only: its Medibook subscription is unpaid.');
  }
  if (h.appVisibility !== 'visible') gaps.push('It is hidden from the patient app.');
  if (!h.onlineBookingEnabled) gaps.push('Online booking is switched off.');
  return gaps;
}
