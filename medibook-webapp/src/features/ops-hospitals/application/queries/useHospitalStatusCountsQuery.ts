import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { fetchHospitalStatusCounts } from '@/features/ops-hospitals/application/usecases/fetchHospitalStatusCounts';

const HOSPITAL_COUNTS_STALE_TIME_MS = 30_000;

/** Registry totals by status, for the KPI row and the Pending tab label. */
export function useHospitalStatusCountsQuery() {
  return useQuery({
    queryKey: hospitalsKeys.counts(),
    queryFn: async () => unwrap(await fetchHospitalStatusCounts()),
    staleTime: HOSPITAL_COUNTS_STALE_TIME_MS,
  });
}
