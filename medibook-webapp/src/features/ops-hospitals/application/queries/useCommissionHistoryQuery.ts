import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { hospitalsKeys } from '@/features/ops-hospitals/application/queries/hospitals.keys';
import { fetchCommissionHistory } from '@/features/ops-hospitals/application/usecases/fetchCommissionHistory';

/** Commission rates (scheduled, current, past); `data === null` on a backend without API-01. */
export function useCommissionHistoryQuery(hospitalId: string) {
  return useQuery({
    queryKey: hospitalsKeys.commissionHistory(hospitalId),
    queryFn: async () => unwrap(await fetchCommissionHistory(hospitalId)),
  });
}
