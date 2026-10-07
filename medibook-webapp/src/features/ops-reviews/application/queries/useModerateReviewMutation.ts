import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { reviewsKeys } from '@/features/ops-reviews/application/queries/reviews.keys';
import {
  moderateReview,
  type ReviewDecision,
} from '@/features/ops-reviews/application/usecases/moderateReview';

interface ModerateInput {
  readonly id: string;
  readonly decision: ReviewDecision;
}

/** Approve or reject one review; the queue is refetched either way. */
export function useModerateReviewMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, decision }: ModerateInput) =>
      unwrap(await moderateReview(id, decision)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reviewsKeys.lists() });
    },
  });
}
