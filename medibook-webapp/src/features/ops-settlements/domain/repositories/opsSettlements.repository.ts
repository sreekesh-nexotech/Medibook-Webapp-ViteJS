import type { Result } from '@/core/error/failure';

import type {
  Payout,
  PayoutRelease,
  PayoutRun,
  PayoutRunDetail,
  PayoutRunDraft,
  PeriodFilter,
  SettlementPeriod,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';

/**
 * Platform settlements: periods, payout runs and payouts. Payouts are
 * recorded, not executed — the transfer itself happens at the bank (Q7).
 * `idempotencyKey` is one per user intent, so a retried submit is not applied twice.
 */
export interface OpsSettlementsRepository {
  listPeriods(filter: PeriodFilter): Promise<Result<readonly SettlementPeriod[]>>;
  listPayoutRuns(): Promise<Result<readonly PayoutRun[]>>;
  getPayoutRun(runId: string): Promise<Result<PayoutRunDetail>>;
  createPayoutRun(draft: PayoutRunDraft, idempotencyKey: string): Promise<Result<PayoutRun>>;
  /** Draft → approved; only an approved run can be released. */
  approvePayoutRun(runId: string): Promise<Result<PayoutRunDetail>>;
  releasePayoutRun(
    runId: string,
    releases: readonly PayoutRelease[],
    idempotencyKey: string,
  ): Promise<Result<PayoutRunDetail>>;
  releasePayout(release: PayoutRelease, idempotencyKey: string): Promise<Result<Payout>>;
}
