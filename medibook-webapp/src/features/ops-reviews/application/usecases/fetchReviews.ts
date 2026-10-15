import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  DoctorReview,
  ReviewListQuery,
} from '@/features/ops-reviews/domain/entities/reviews.entities';
import { reviewsRepository } from '@/features/ops-reviews/infrastructure/repositories/reviews.repository.impl';

export function fetchReviews(query: ReviewListQuery): Promise<Result<Page<DoctorReview>>> {
  return reviewsRepository.listReviews(query);
}
