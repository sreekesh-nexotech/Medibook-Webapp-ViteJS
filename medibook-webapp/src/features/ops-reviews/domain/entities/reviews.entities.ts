/** Patient reviews of doctors awaiting or past moderation (Q77, `/platform/reviews`). */

export type ReviewModeration = 'pending' | 'approved' | 'rejected';

export const REVIEW_MODERATIONS: readonly ReviewModeration[] = ['pending', 'approved', 'rejected'];

export interface DoctorReview {
  readonly id: string;
  readonly hospitalId: string;
  readonly hospitalName: string;
  readonly doctorId: string;
  readonly doctorName: string;
  /** The booking the review is about (human reference only; never a UUID on screen). */
  readonly bookingRef: string | null;
  /** 1–5. */
  readonly rating: number;
  readonly comment: string | null;
  readonly isPublished: boolean;
  readonly moderation: ReviewModeration;
  readonly moderatedAt: string | null;
  readonly createdAt: string;
}

export interface ReviewListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly moderation: ReviewModeration | null;
  readonly hospitalId: string | null;
  readonly rating: number | null;
}
