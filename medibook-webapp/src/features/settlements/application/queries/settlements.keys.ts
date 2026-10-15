import type {
  PayoutListQuery,
  SettlementPeriodFilters,
  StatementListQuery,
} from '@/features/settlements/domain/entities/settlements.entities';

/** Query keys for the settlement ledger (standards §4 — no inline key arrays). */
export const settlementsKeys = {
  all: ['settlements'] as const,
  periods: (filters: SettlementPeriodFilters) =>
    [...settlementsKeys.all, 'periods', filters] as const,
  period: (periodId: string) => [...settlementsKeys.all, 'period', periodId] as const,
  statementForDate: (date: string) => [...settlementsKeys.all, 'statement-for', date] as const,
  statements: (query: StatementListQuery) => [...settlementsKeys.all, 'statements', query] as const,
  payouts: (query: PayoutListQuery) => [...settlementsKeys.all, 'payouts', query] as const,
};
