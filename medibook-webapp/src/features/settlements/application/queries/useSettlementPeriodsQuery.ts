import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { SettlementPeriodFilters } from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsKeys } from '@/features/settlements/application/queries/settlements.keys';
import { fetchSettlementPeriods } from '@/features/settlements/application/usecases/fetchSettlementPeriods';

/** Periods close weekly; a minute of staleness is plenty. */
const PERIODS_STALE_TIME_MS = 60_000;

/** The latest (up to 100) settlement periods in the date range; the old rows stay while a new range loads. */
export function useSettlementPeriodsQuery(filters: SettlementPeriodFilters, enabled = true) {
  return useQuery({
    queryKey: settlementsKeys.periods(filters),
    queryFn: async () => unwrap(await fetchSettlementPeriods(filters)),
    placeholderData: keepPreviousData,
    staleTime: PERIODS_STALE_TIME_MS,
    enabled,
  });
}
