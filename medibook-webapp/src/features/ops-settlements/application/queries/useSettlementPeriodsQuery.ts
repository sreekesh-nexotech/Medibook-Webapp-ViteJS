import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { fetchSettlementPeriods } from '@/features/ops-settlements/application/usecases/fetchSettlementPeriods';
import type { PeriodFilter } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/** Settlement periods matching `filter` (every page). Keeps the last result while a new filter loads. */
export function useSettlementPeriodsQuery(filter: PeriodFilter) {
  return useQuery({
    queryKey: opsSettlementsKeys.periods(filter),
    queryFn: async () => unwrap(await fetchSettlementPeriods(filter)),
    placeholderData: keepPreviousData,
  });
}
