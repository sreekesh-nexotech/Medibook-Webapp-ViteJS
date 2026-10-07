import { describe, expect, it } from 'vitest';

import type { DoctorReview } from '@/features/ops-reviews/domain/entities/reviews.entities';
import { toDoctorReview } from '@/features/ops-reviews/infrastructure/data-sources/remote/reviews.response';
import {
  reviewActions,
  tabModeration,
} from '@/features/ops-reviews/presentation/components/reviews.view';

const review: DoctorReview = toDoctorReview({
  id: 'r1',
  hospital_id: 'h1',
  hospital_name: 'Lakeshore',
  doctor_id: 'd1',
  doctor_name: 'Dr. Meera Pillai',
  appointment_id: 'a1',
  booking_ref: 'LKS-B-000123',
  rating: 4,
  comment: 'Kind and on time.',
  is_published: false,
  moderation_status: 'pending',
  moderated_by_id: null,
  moderated_at: null,
  created_at: '2026-10-06T10:00:00Z',
  version: 1,
});

describe('review moderation', () => {
  it('offers both decisions on a pending review', () => {
    expect(reviewActions(review)).toEqual({ canApprove: true, canReject: true });
  });

  it('never repeats the decision already taken (the backend refuses it)', () => {
    expect(reviewActions({ ...review, moderation: 'approved' })).toEqual({
      canApprove: false,
      canReject: true,
    });
    expect(reviewActions({ ...review, moderation: 'rejected' })).toEqual({
      canApprove: true,
      canReject: false,
    });
  });

  it('maps tabs to the status filter', () => {
    expect(tabModeration('Pending')).toBe('pending');
    expect(tabModeration('All')).toBeNull();
  });
});
