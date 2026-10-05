import { useQueries } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { opsSettlementsKeys } from '@/features/ops-settlements/application/queries/opsSettlements.keys';
import { fetchPayoutRun } from '@/features/ops-settlements/application/usecases/fetchPayoutRun';
import type { PayoutRunDetail } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

export interface PayoutRunDetailsResult {
  readonly details: readonly PayoutRunDetail[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly refetch: () => Promise<void>;
}

/**
 * The payouts of each run in `runIds` — the backend has no flat payout list,
 * so a period's payout (status, UTR, bank) is read through its run.
 */
export function usePayoutRunDetailsQueries(runIds: readonly string[]): PayoutRunDetailsResult {
  return useQueries({
    queries: runIds.map((runId) => ({
      queryKey: opsSettlementsKeys.run(runId),
      queryFn: async () => unwrap(await fetchPayoutRun(runId)),
    })),
    combine: (results) => {
      const failed = results.find((r) => r.isError);
      return {
        details: results.flatMap((r) => (r.data ? [r.data] : [])),
        isLoading: results.some((r) => r.isLoading),
        isError: failed !== undefined,
        error: failed?.error ?? null,
        refetch: async () => {
          await Promise.all(results.map((r) => r.refetch()));
        },
      };
    },
  });
}
