import { platformApi } from '@/core/api/http';

import type { ReviewListQuery } from '@/features/ops-reviews/domain/entities/reviews.entities';
import {
  reviewPageResponseSchema,
  reviewResponseSchema,
} from '@/features/ops-reviews/infrastructure/data-sources/remote/reviews.response';

const REVIEWS_PATH = '/reviews';

/** `GET /platform/reviews?status&hospital_id&rating` — oldest first, so the queue reads in order. */
export async function getReviews(query: ReviewListQuery) {
  const response = await platformApi.get(REVIEWS_PATH, {
    params: {
      page: query.page,
      page_size: query.pageSize,
      sort: 'created_at',
      ...(query.moderation ? { status: query.moderation } : {}),
      ...(query.hospitalId ? { hospital_id: query.hospitalId } : {}),
      ...(query.rating !== null ? { rating: query.rating } : {}),
    },
  });
  return reviewPageResponseSchema.parse(response.data);
}

export async function postApproveReview(id: string) {
  const response = await platformApi.post(`${REVIEWS_PATH}/${encodeURIComponent(id)}/approve`, {});
  return reviewResponseSchema.parse(response.data);
}

export async function postRejectReview(id: string, reason: string | null) {
  const response = await platformApi.post(
    `${REVIEWS_PATH}/${encodeURIComponent(id)}/reject`,
    reason ? { reason } : {},
  );
  return reviewResponseSchema.parse(response.data);
}
