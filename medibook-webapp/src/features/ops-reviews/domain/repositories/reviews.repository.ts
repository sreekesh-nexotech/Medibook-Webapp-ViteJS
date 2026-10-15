import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  DoctorReview,
  ReviewListQuery,
} from '@/features/ops-reviews/domain/entities/reviews.entities';

/** The review moderation queue (`notifications.edit`). */
export interface ReviewsRepository {
  listReviews(query: ReviewListQuery): Promise<Result<Page<DoctorReview>>>;
  /** Publish the review; the doctor's and hospital's ratings are recomputed. */
  approveReview(id: string): Promise<Result<DoctorReview>>;
  rejectReview(id: string, reason: string | null): Promise<Result<DoctorReview>>;
}
