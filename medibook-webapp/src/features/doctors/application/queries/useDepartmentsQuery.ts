import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { doctorsKeys } from '@/features/doctors/application/queries/doctors.keys';
import { fetchDepartments } from '@/features/doctors/application/usecases/fetchDepartments';

/** The catalogue changes rarely; a minute of freshness avoids refetch storms across screens. */
const CATALOGUE_STALE_TIME_MS = 60_000;

/** The hospital's departments, in the backend's display order. */
export function useDepartmentsQuery() {
  return useQuery({
    queryKey: doctorsKeys.departments(),
    queryFn: async () => unwrap(await fetchDepartments()),
    staleTime: CATALOGUE_STALE_TIME_MS,
  });
}
