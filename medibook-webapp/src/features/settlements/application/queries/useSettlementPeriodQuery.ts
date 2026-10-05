import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { settlementsKeys } from '@/features/settlements/application/queries/settlements.keys';
import { fetchSettlementPeriod } from '@/features/settlements/application/usecases/fetchSettlementPeriod';

/** An open period's breakdown is computed live, so it is re-read after half a minute. */
const PERIOD_STALE_TIME_MS = 30_000;

/** One period with its breakdown, adjustments and payout; idle until `periodId` is set. */
export function useSettlementPeriodQuery(periodId: string | null) {
  return useQuery({
    queryKey: settlementsKeys.period(periodId ?? ''),
    queryFn: async () => unwrap(await fetchSettlementPeriod(periodId ?? '')),
    enabled: periodId !== null,
    staleTime: PERIOD_STALE_TIME_MS,
  });
}
