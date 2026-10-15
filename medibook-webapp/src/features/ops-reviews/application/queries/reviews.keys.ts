import type { ReviewListQuery } from '@/features/ops-reviews/domain/entities/reviews.entities';

/** Query keys for review moderation. */
export const reviewsKeys = {
  all: ['ops-reviews'] as const,
  lists: () => [...reviewsKeys.all, 'list'] as const,
  list: (query: ReviewListQuery) => [...reviewsKeys.lists(), query] as const,
};
