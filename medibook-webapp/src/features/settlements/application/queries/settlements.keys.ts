import type { SettlementPeriodFilters } from '@/features/settlements/domain/entities/settlements.entities';

/** Query keys for the settlement ledger (standards §4 — no inline key arrays). */
export const settlementsKeys = {
  all: ['settlements'] as const,
  periods: (filters: SettlementPeriodFilters) =>
    [...settlementsKeys.all, 'periods', filters] as const,
  period: (periodId: string) => [...settlementsKeys.all, 'period', periodId] as const,
  statement: (periodStart: string) => [...settlementsKeys.all, 'statement', periodStart] as const,
};
