import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  Payout,
  PayoutListQuery,
  SettlementPeriodDetail,
  SettlementPeriodFilters,
  SettlementPeriodWindow,
  SettlementStatement,
  StatementListQuery,
  StatementPdf,
} from '@/features/settlements/domain/entities/settlements.entities';

/** The hospital's settlement ledger — read-only on this surface. */
export interface SettlementsRepository {
  /** The latest periods matching `filters` (one backend page of up to 100). */
  listPeriods(filters: SettlementPeriodFilters): Promise<Result<SettlementPeriodWindow>>;
  getPeriod(periodId: string): Promise<Result<SettlementPeriodDetail>>;
  /**
   * The statement of the month containing `date`, or `null` if none is issued
   * yet — for a period detail from a server that does not link it.
   */
  findStatementForDate(date: string): Promise<Result<SettlementStatement | null>>;
  /** One page of the monthly statements. */
  listStatements(query: StatementListQuery): Promise<Result<Page<SettlementStatement>>>;
  /** A statement's PDF: a signed link, or the file itself. */
  getStatementPdf(statementId: string): Promise<Result<StatementPdf>>;
  /** One page of the payouts Medibook made to the hospital. */
  listPayouts(query: PayoutListQuery): Promise<Result<Page<Payout>>>;
}
