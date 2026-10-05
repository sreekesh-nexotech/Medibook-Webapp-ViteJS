import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { fetchDoctors } from '@/features/doctors/application/usecases/fetchDoctors';

const CATALOGUE_STALE_TIME_MS = 60_000;

/**
 * Every doctor of the hospital. Other modules that start after H1 read the
 * roster through this hook (search/filter client-side — the roster is small).
 */
export function useDoctorsQuery() {
  return useQuery({
    queryKey: doctorsKeys.lists(),
    queryFn: async () => unwrap(await fetchDoctors()),
    staleTime: CATALOGUE_STALE_TIME_MS,
  });
}
