import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  AdjustmentDraft,
  Payout,
  PayoutCommand,
  PayoutFilter,
  PayoutRelease,
  PayoutRun,
  PayoutRunCreated,
  PayoutRunDetail,
  PayoutRunDraft,
  PeriodCloseOutcome,
  PeriodCloseRequest,
  PeriodFilter,
  PlatformStatement,
  SettlementAdjustment,
  SettlementExportFormat,
  SettlementFile,
  SettlementPeriod,
  SettlementPeriodDetail,
  StatementIssueResult,
  StatementListParams,
  StatementPdf,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/**
 * Platform settlements: periods, payout runs and payouts, and the monthly
 * statements. Payouts are recorded, not executed — the transfer itself happens
 * at the bank (Q7). `idempotencyKey` is one per user intent, so a retried
 * submit is not applied twice.
 */
export interface OpsSettlementsRepository {
  listPeriods(filter: PeriodFilter): Promise<Result<readonly SettlementPeriod[]>>;
  /** One period with its breakdown, adjustments, payout and statements. */
  getPeriod(periodId: string): Promise<Result<SettlementPeriodDetail>>;
  /**
   * Close periods. `confirm: false` asks for the dry run (BE-27); a backend
   * without dry runs closes anyway and says so (`legacy`).
   */
  closePeriods(request: PeriodCloseRequest, confirm: boolean): Promise<Result<PeriodCloseOutcome>>;
  addAdjustment(
    draft: AdjustmentDraft,
    idempotencyKey: string,
  ): Promise<Result<SettlementAdjustment>>;
  listPayoutRuns(): Promise<Result<readonly PayoutRun[]>>;
  getPayoutRun(runId: string): Promise<Result<PayoutRunDetail>>;
  /** Every payout across runs (BE-27); `null` on a backend without the flat list. */
  listPayouts(filter: PayoutFilter): Promise<Result<readonly Payout[] | null>>;
  createPayoutRun(draft: PayoutRunDraft, idempotencyKey: string): Promise<Result<PayoutRunCreated>>;
  /** Draft → approved; only an approved run can be released. */
  approvePayoutRun(runId: string): Promise<Result<PayoutRunDetail>>;
  releasePayoutRun(
    runId: string,
    releases: readonly PayoutRelease[],
    idempotencyKey: string,
  ): Promise<Result<PayoutRunDetail>>;
  releasePayout(release: PayoutRelease, idempotencyKey: string): Promise<Result<Payout>>;
  /** Hold (from pending) or fail (from pending / on hold) a payout. */
  commandPayout(
    payoutId: string,
    command: PayoutCommand,
    reason: string,
    idempotencyKey: string,
  ): Promise<Result<Payout>>;
  listStatements(params: StatementListParams): Promise<Result<Page<PlatformStatement>>>;
  /** Issue every hospital's statement for a month (`YYYY-MM`); already issued ones are skipped. */
  issueStatements(month: string, idempotencyKey: string): Promise<Result<StatementIssueResult>>;
  statementPdf(statement: PlatformStatement): Promise<Result<StatementPdf>>;
  /** The period list as a file, with the list's filters. */
  exportPeriods(
    format: SettlementExportFormat,
    filter: PeriodFilter,
  ): Promise<Result<SettlementFile>>;
}
