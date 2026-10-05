import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { fetchHospital } from '@/features/ops-hospitals/application/usecases/fetchHospital';

const HOSPITAL_DETAIL_STALE_TIME_MS = 30_000;

/** One hospital's full platform profile. */
export function useHospitalQuery(id: string) {
  return useQuery({
    queryKey: hospitalsKeys.detail(id),
    queryFn: async () => unwrap(await fetchHospital(id)),
    staleTime: HOSPITAL_DETAIL_STALE_TIME_MS,
  });
}
