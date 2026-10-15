import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { PayoutListQuery } from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsKeys } from '@/features/settlements/application/queries/settlements.keys';
import { fetchPayouts } from '@/features/settlements/application/usecases/fetchPayouts';

/** Payouts are released in runs a few times a month. */
const PAYOUTS_STALE_TIME_MS = 60_000;

/** One page of the hospital's payouts; the old page stays while the next loads. */
export function usePayoutsQuery(query: PayoutListQuery, enabled = true) {
  return useQuery({
    queryKey: settlementsKeys.payouts(query),
    queryFn: async () => unwrap(await fetchPayouts(query)),
    placeholderData: keepPreviousData,
    staleTime: PAYOUTS_STALE_TIME_MS,
    enabled,
  });
}
