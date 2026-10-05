import type { PeriodFilter } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/** Query keys for the ops settlement queue. */
export const opsSettlementsKeys = {
  all: ['ops-settlements'] as const,
  periods: (filter: PeriodFilter) => [...opsSettlementsKeys.all, 'periods', filter] as const,
  runs: () => [...opsSettlementsKeys.all, 'runs'] as const,
  run: (runId: string) => [...opsSettlementsKeys.all, 'run', runId] as const,
};
