import type {
  PayoutFilter,
  PeriodFilter,
  StatementListParams,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/** Query keys for the ops settlement queue and statements. */
export const opsSettlementsKeys = {
  all: ['ops-settlements'] as const,
  periods: (filter: PeriodFilter) => [...opsSettlementsKeys.all, 'periods', filter] as const,
  period: (periodId: string) => [...opsSettlementsKeys.all, 'period', periodId] as const,
  runs: () => [...opsSettlementsKeys.all, 'runs'] as const,
  run: (runId: string) => [...opsSettlementsKeys.all, 'run', runId] as const,
  payouts: (filter: PayoutFilter) => [...opsSettlementsKeys.all, 'payouts', filter] as const,
  statements: (params: StatementListParams) =>
    [...opsSettlementsKeys.all, 'statements', params] as const,
};
