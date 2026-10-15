import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type { DoctorReview } from '@/features/ops-reviews/domain/entities/reviews.entities';

/** `PlatformReviewSerializer`. */
export const reviewResponseSchema = z.object({
  id: z.string(),
  hospital_id: z.string(),
  hospital_name: z.string(),
  doctor_id: z.string(),
  doctor_name: z.string(),
  appointment_id: z.string().nullable(),
  booking_ref: z.string().nullable(),
  rating: z.number().int(),
  comment: z.string().nullable(),
  is_published: z.boolean(),
  moderation_status: z.enum(['pending', 'approved', 'rejected']),
  moderated_by_id: z.string().nullable(),
  moderated_at: z.string().nullable(),
  created_at: z.string(),
  version: z.number().int(),
});

export const reviewPageResponseSchema = paginatedSchema(reviewResponseSchema);

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

export function toDoctorReview(dto: ReviewResponse): DoctorReview {
  return {
    id: dto.id,
    hospitalId: dto.hospital_id,
    hospitalName: dto.hospital_name,
    doctorId: dto.doctor_id,
    doctorName: dto.doctor_name,
    bookingRef: dto.booking_ref,
    rating: dto.rating,
    comment: dto.comment,
    isPublished: dto.is_published,
    moderation: dto.moderation_status,
    moderatedAt: dto.moderated_at,
    createdAt: dto.created_at,
  };
}
