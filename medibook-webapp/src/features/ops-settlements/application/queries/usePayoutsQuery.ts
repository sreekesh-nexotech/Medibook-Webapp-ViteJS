import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { fetchPayouts } from '@/features/ops-settlements/application/usecases/fetchPayouts';
import type { PayoutFilter } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/**
 * Every payout in one list (BE-27, UAT 09·F12). `data === null` means the
 * backend has no flat list; the screen then reads each run's payouts.
 */
export function usePayoutsQuery(filter: PayoutFilter) {
  return useQuery({
    queryKey: opsSettlementsKeys.payouts(filter),
    queryFn: async () => unwrap(await fetchPayouts(filter)),
  });
}
