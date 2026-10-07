import type { Result } from '@/core/error/failure';

import type { DoctorReview } from '@/features/ops-reviews/domain/entities/reviews.entities';
import { reviewsRepository } from '@/features/ops-reviews/infrastructure/repositories/reviews.repository.impl';

/** What a moderator decided: publish it, or reject it with an optional reason. */
export type ReviewDecision =
  { readonly action: 'approve' } | { readonly action: 'reject'; readonly reason: string | null };

export function moderateReview(
  id: string,
  decision: ReviewDecision,
): Promise<Result<DoctorReview>> {
  return decision.action === 'approve'
    ? reviewsRepository.approveReview(id)
    : reviewsRepository.rejectReview(id, decision.reason);
}
