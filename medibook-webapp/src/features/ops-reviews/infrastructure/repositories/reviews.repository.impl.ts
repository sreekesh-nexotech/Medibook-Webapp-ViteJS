import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { ReviewsRepository } from '@/features/ops-reviews/domain/repositories/reviews.repository';
import {
  getReviews,
  postApproveReview,
  postRejectReview,
} from '@/features/ops-reviews/infrastructure/data-sources/remote/reviews.api';
import { toDoctorReview } from '@/features/ops-reviews/infrastructure/data-sources/remote/reviews.response';

export const reviewsRepository: ReviewsRepository = {
  listReviews: (query) => attempt(async () => toPage(await getReviews(query), toDoctorReview)),
  approveReview: (id) => attempt(async () => toDoctorReview(await postApproveReview(id))),
  rejectReview: (id, reason) =>
    attempt(async () => toDoctorReview(await postRejectReview(id, reason))),
};
