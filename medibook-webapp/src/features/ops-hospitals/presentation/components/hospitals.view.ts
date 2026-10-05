import type {
  HospitalLifecycle,
  HospitalOnboardingStage,
  HospitalSuspensionReason,
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
