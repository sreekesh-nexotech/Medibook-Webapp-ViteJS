/**
 * Presentation lookups for the API-backed onboarding pipeline (P3): stage and
 * checklist vocabulary, which status pill each borrows, and the sentence each
 * go-live blocker reads as.
 */
import type { IconName } from '@/shared/ui/icon-registry';

import type {
  ChecklistItem,
  ChecklistStatus,
  GoLiveBlocker,
  ManualOnboardingStage,
  OnboardingCaseStage,
} from '@/features/ops-hospitals/domain/entities/onboarding.entity';

/** The pipeline in order, for the stage strip and the stage filter. */
export const PIPELINE_STAGES: readonly OnboardingCaseStage[] = [
  'application',
  'documents_pending',
  'review',
  'approved',
  'live',
  'rejected',
];

export const STAGE_LABEL: Readonly<Record<OnboardingCaseStage, string>> = {
  application: 'Application',
  documents_pending: 'Documents requested',
  review: 'Under review',
  approved: 'Approved',
  live: 'Live',
  rejected: 'Rejected',
};

/** Status-pill key per stage (the real word is passed as the label). */
export const STAGE_PILL: Readonly<Record<OnboardingCaseStage, string>> = {
  application: 'Queued',
  documents_pending: 'Requested',
  review: 'Pending',
  approved: 'Verified',
  live: 'Live',
  rejected: 'Rejected',
};

export const STAGE_GLYPH: Readonly<Record<OnboardingCaseStage, IconName>> = {
  application: 'user-plus',
  documents_pending: 'send',
  review: 'shield-check',
  approved: 'circle-check',
  live: 'rocket',
  rejected: 'circle-x',
};

/** One line of context per stage, so a count is never just a number. */
export const STAGE_CONTEXT: Readonly<Record<OnboardingCaseStage, string>> = {
  application: 'Onboarded — checklist being collected',
  documents_pending: 'Waiting on the hospital for documents',
  review: 'Documents in hand, being checked',
  approved: 'Approved — waiting on go-live',
  live: 'Serving patients on Medibook',
  rejected: 'Application closed with a reason',
};

/** Tinted icon box per stage, reusing the ops accent pairs. */
export const STAGE_TINT: Readonly<Record<OnboardingCaseStage, string>> = {
  application: 'bg-blue-soft-bg text-blue',
  documents_pending: 'bg-y-100 text-y-600',
  review: 'bg-badge-noshow-bg text-orange',
  approved: 'bg-g-100 text-g-600',
  live: 'bg-g-100 text-g-700',
  rejected: 'bg-d-100 text-d-500',
};

/** The stages an operator moves a case between by hand. */
export const MANUAL_STAGES: readonly ManualOnboardingStage[] = [
  'application',
  'documents_pending',
  'review',
];

export function isManualStage(stage: OnboardingCaseStage): stage is ManualOnboardingStage {
  return stage === 'application' || stage === 'documents_pending' || stage === 'review';
}

export const CHECKLIST_LABEL: Readonly<Record<ChecklistStatus, string>> = {
  pending: 'Pending',
  received: 'Received',
  verified: 'Verified',
  waived: 'Waived',
};

export const CHECKLIST_PILL: Readonly<Record<ChecklistStatus, string>> = {
  pending: 'Requested',
  received: 'Submitted',
  verified: 'Verified',
  waived: 'Waived',
};

export const CHECKLIST_TINT: Readonly<Record<ChecklistStatus, string>> = {
  pending: 'bg-grey-300 text-text-muted',
  received: 'bg-y-100 text-y-600',
  verified: 'bg-g-100 text-g-600',
  waived: 'bg-grey-300 text-text-muted',
};

/** The code the backend uses for "no administrator has accepted yet". */
export const NO_ADMIN_BLOCKER = 'no_admin_accepted';

/** Blocker code → sentence (backend `platform_hospitals.go_live_blockers`). */
export function blockerCopy(blocker: GoLiveBlocker, checklist: readonly ChecklistItem[]): string {
  const names = blocker.details.map((code) => checklist.find((i) => i.code === code)?.name ?? code);
  switch (blocker.code) {
    case 'not_approved':
      return 'The application has not been approved yet (L-29): approve it first.';
    case 'checklist_incomplete':
      return `${names.length} checklist document${names.length === 1 ? '' : 's'} not verified or waived: ${names.join(', ')}.`;
    case NO_ADMIN_BLOCKER:
      return 'The first administrator has not accepted the invitation yet.';
    case 'no_bank_account':
      return 'The hospital has no payout bank account.';
    case 'no_subscription':
      return 'The hospital has no active or trial subscription.';
    case 'numbering_not_confirmed':
      return `Numbering formats are not confirmed${names.length > 0 ? `: ${names.join(', ')}` : ''}.`;
    default:
      return 'Something else is still blocking go-live.';
  }
}

/** The reason that requires the free-text note to be filled in. */
export const OTHER_REASON = 'Other — see the note';

/** Reasons a collected document is sent back to the hospital. */
export const SEND_BACK_REASONS: readonly string[] = [
  'Document is illegible or partially cut off',
  'Details do not match the registered entity',
  'Document has expired',
  'Wrong document provided',
  OTHER_REASON,
];

/** Reasons a whole application is rejected. */
export const REJECT_APPLICATION_REASONS: readonly string[] = [
  'Registration could not be verified',
  'Documents were not provided in time',
  'Hospital does not meet the listing criteria',
  'Duplicate application',
  OTHER_REASON,
];
