import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { fetchPayoutRuns } from '@/features/ops-settlements/application/usecases/fetchPayoutRuns';

/** Every payout run, newest first. */
export function usePayoutRunsQuery() {
  return useQuery({
    queryKey: opsSettlementsKeys.runs(),
    queryFn: async () => unwrap(await fetchPayoutRuns()),
  });
}
