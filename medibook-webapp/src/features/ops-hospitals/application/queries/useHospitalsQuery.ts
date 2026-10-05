import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { HospitalListQuery } from '@/features/ops-hospitals/domain/entities/hospitals.entity';
import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { fetchHospitals } from '@/features/ops-hospitals/application/usecases/fetchHospitals';

/** The registry changes with onboarding and suspensions; re-check every half minute. */
const HOSPITALS_STALE_TIME_MS = 30_000;

/**
 * One server-side page of the hospital registry. Keeps the last page on
 * screen while the next loads. `enabled: false` holds the request until its
 * inputs are known (e.g. a plan filter waiting for the plan catalogue).
 */
export function useHospitalsQuery(query: HospitalListQuery, enabled = true) {
  return useQuery({
    enabled,
    queryKey: hospitalsKeys.list(query),
    queryFn: async () => unwrap(await fetchHospitals(query)),
    staleTime: HOSPITALS_STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });
}
