import type {
  DoctorReview,
  ReviewModeration,
} from '@/features/ops-reviews/domain/entities/reviews.entities';

/** The tabs over the queue: one per moderation state, plus everything. */
export const REVIEW_TABS = ['Pending', 'Approved', 'Rejected', 'All'] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];

export function tabModeration(tab: ReviewTab): ReviewModeration | null {
  if (tab === 'Pending') return 'pending';
  if (tab === 'Approved') return 'approved';
  if (tab === 'Rejected') return 'rejected';
  return null;
}

export const MODERATION_LOOK: Readonly<
  Record<ReviewModeration, { readonly label: string; readonly badge: string }>
> = {
  pending: { label: 'Pending', badge: 'Pending' },
  approved: { label: 'Published', badge: 'Live' },
  rejected: { label: 'Rejected', badge: 'Rejected' },
};

/**
 * What a moderator can do next (backend refuses approving an approved review
 * and rejecting a rejected one): a pending review either way, a published one
 * can be taken down, a rejected one can still be published.
 */
export function reviewActions(r: DoctorReview): {
  readonly canApprove: boolean;
  readonly canReject: boolean;
} {
  return { canApprove: r.moderation !== 'approved', canReject: r.moderation !== 'rejected' };
}

/** Ratings 1–5 as filter choices. */
export const RATINGS: readonly number[] = [5, 4, 3, 2, 1];

/** Stars as text for a screen reader and a title: "4 out of 5 stars". */
export function ratingLabel(rating: number): string {
  return `${rating} out of 5 stars`;
}
