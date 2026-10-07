import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { fetchSettlementPeriod } from '@/features/ops-settlements/application/usecases/fetchSettlementPeriod';

/** One period with its breakdown, adjustments, payout and statements (R4); idle without an id. */
export function useSettlementPeriodQuery(periodId: string | null) {
  return useQuery({
    queryKey: opsSettlementsKeys.period(periodId ?? ''),
    queryFn: async () => unwrap(await fetchSettlementPeriod(periodId ?? '')),
    enabled: periodId !== null,
  });
}
