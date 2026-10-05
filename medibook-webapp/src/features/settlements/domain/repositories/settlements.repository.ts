import type { Result } from '@/core/error/failure';

import type {
  SettlementPeriodDetail,
  SettlementPeriodFilters,
  SettlementPeriodWindow,
  SettlementStatement,
} from '@/features/settlements/domain/entities/settlements.entities';

/** The hospital's settlement ledger — read-only on this surface. */
export interface SettlementsRepository {
  /** The latest periods matching `filters` (one backend page of up to 100). */
  listPeriods(filters: SettlementPeriodFilters): Promise<Result<SettlementPeriodWindow>>;
  getPeriod(periodId: string): Promise<Result<SettlementPeriodDetail>>;
  /** The statement issued for the period starting `periodStart`, or `null` if none yet. */
  findStatement(periodStart: string): Promise<Result<SettlementStatement | null>>;
  /** Render a statement PDF on demand (for statements with no stored file). */
  getStatementPdf(statementId: string): Promise<Result<Blob>>;
}
