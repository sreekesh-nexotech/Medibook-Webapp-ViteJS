import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { reviewsKeys } from '@/features/ops-reviews/application/queries/reviews.keys';
import { fetchReviews } from '@/features/ops-reviews/application/usecases/fetchReviews';
import type { ReviewListQuery } from '@/features/ops-reviews/domain/entities/reviews.entities';

/** New reviews arrive as patients finish visits; half a minute is fresh enough for a queue. */
const REVIEWS_STALE_MS = 30_000;

/** One page of the review queue (`GET /platform/reviews`). */
export function useReviewsQuery(query: ReviewListQuery) {
  return useQuery({
    queryKey: reviewsKeys.list(query),
    queryFn: async () => unwrap(await fetchReviews(query)),
    staleTime: REVIEWS_STALE_MS,
    placeholderData: keepPreviousData,
  });
}
