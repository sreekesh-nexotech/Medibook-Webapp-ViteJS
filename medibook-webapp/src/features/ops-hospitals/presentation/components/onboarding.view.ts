/**
 * Presentation-only lookups for the onboarding pipeline: which status pill
 * each stage and document decision borrows, and how a file size reads.
 *
 * `Badge` owns one palette for the whole product and `shared/**` is finished,
 * so the onboarding vocabulary maps onto the pills that already exist —
 * "Approved" borrows the Verified green, "Uploaded" the Submitted amber — and
 * the real word is passed as the badge's label.
 */
import type { IconName } from '@/shared/ui/icon-registry';

import type {
  AdminInviteStatus,
  DocReviewStatus,
  OnboardingStage,
} from '@/features/ops-hospitals/application/store/onboarding.types';

/** Status-pill key per pipeline stage. */
export const STAGE_BADGE: Readonly<Record<OnboardingStage, string>> = {
  Application: 'Queued',
  'Documents requested': 'Requested',
  'Under review': 'Pending',
  Approved: 'Verified',
  Live: 'Live',
};

/** Glyph per pipeline stage, for the stage strip. */
export const STAGE_ICON: Readonly<Record<OnboardingStage, IconName>> = {
  Application: 'user-plus',
  'Documents requested': 'send',
  'Under review': 'shield-check',
  Approved: 'circle-check',
  Live: 'rocket',
};

/** One line of context per stage, so a count is never just a number. */
export const STAGE_HINT: Readonly<Record<OnboardingStage, string>> = {
  Application: 'Onboarded — no checklist requested yet',
  'Documents requested': 'Waiting on the hospital to upload',
  'Under review': 'Documents waiting on a reviewer',
  Approved: 'All documents approved — ready to go live',
  Live: 'Serving patients on Medibook',
};

/** Status-pill key per document decision. */
export const DOC_BADGE: Readonly<Record<DocReviewStatus, string>> = {
  Requested: 'Requested',
  Uploaded: 'Submitted',
  Approved: 'Verified',
  Rejected: 'Rejected',
};

/** Status-pill key per invitation state. */
export const INVITE_BADGE: Readonly<Record<AdminInviteStatus, string>> = {
  Invited: 'Queued',
  Accepted: 'Verified',
  Expired: 'Expired',
};

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = BYTES_PER_KB * 1024;

/** "482 KB", "1.6 MB" — how the review row reports what is on file. */
export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  if (bytes >= BYTES_PER_MB) return `${(bytes / BYTES_PER_MB).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / BYTES_PER_KB))} KB`;
}
