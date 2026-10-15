import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { fetchDoctorReviews } from '@/features/doctors/application/usecases/fetchDoctorReviews';

/** Reviews change only when Medibook moderates one; a few minutes is fresh enough. */
const REVIEWS_STALE_TIME_MS = 5 * 60_000;

/**
 * One page of a doctor's approved reviews (`GET /hospital/doctors/{id}/reviews`,
 * DOC-01). Not retried: a backend without the endpoint answers 404, which the
 * screen shows as "not available yet" rather than an error loop.
 */
export function useDoctorReviewsQuery(doctorId: string | null, page: number) {
  return useQuery({
    queryKey: doctorsKeys.reviews(doctorId ?? '', page),
    queryFn: async () => unwrap(await fetchDoctorReviews(doctorId ?? '', page)),
    enabled: doctorId !== null,
    staleTime: REVIEWS_STALE_TIME_MS,
    placeholderData: keepPreviousData,
    retry: false,
  });
}
