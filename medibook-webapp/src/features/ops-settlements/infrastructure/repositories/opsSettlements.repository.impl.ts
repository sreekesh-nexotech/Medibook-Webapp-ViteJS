import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';
import { ok } from '@/core/error/failure';

import type { OpsSettlementsRepository } from '@/features/ops-settlements/domain/repositories/opsSettlements.repository';
import {
  getPayoutRun,
  getPayoutRuns,
  getPayouts,
  getPeriod,
  getPeriods,
  getSettlementsExport,
  getStatementPdf,
  getStatements,
  postAdjustment,
  postPayoutCommand,
  postPayoutRelease,
  postPayoutRun,
  postPayoutRunApprove,
  postPayoutRunRelease,
  postPeriodClose,
  postStatementIssue,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.api';
import {
  toAdjustmentCreateRequest,
  toPayoutRunCreateRequest,
  toPayoutRunReleaseRequest,
  toPeriodCloseBody,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.request';
import {
  toAdjustment,
  toPayout,
  toPayoutRun,
  toPayoutRunCreated,
  toPayoutRunDetail,
  toPeriodCloseOutcome,
  toPeriodDetail,
  toPlatformStatement,
  toSettlementPeriod,
  toStatementIssueResult,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.response';

/** Keep a filename to what every OS accepts. */
function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_');
}

export const opsSettlementsRepository: OpsSettlementsRepository = {
  listPeriods: (filter) => attempt(async () => (await getPeriods(filter)).map(toSettlementPeriod)),

  getPeriod: (periodId) => attempt(async () => toPeriodDetail(await getPeriod(periodId))),

  closePeriods: (request, confirm) =>
    attempt(async () =>
      toPeriodCloseOutcome(await postPeriodClose(toPeriodCloseBody(request), confirm)),
    ),

  addAdjustment: (draft, key) =>
    attempt(async () => toAdjustment(await postAdjustment(toAdjustmentCreateRequest(draft), key))),

  listPayoutRuns: () => attempt(async () => (await getPayoutRuns()).map(toPayoutRun)),

  getPayoutRun: (runId) => attempt(async () => toPayoutRunDetail(await getPayoutRun(runId))),

  listPayouts: async (filter) => {
    const result = await attempt(async () => (await getPayouts(filter)).map(toPayout));
    // A backend without the flat list (BE-27) answers 404: the caller reads runs instead.
    return !result.ok && result.failure.kind === 'notFound' ? ok(null) : result;
  },

  createPayoutRun: (draft, key) =>
    attempt(async () =>
      toPayoutRunCreated(await postPayoutRun(toPayoutRunCreateRequest(draft), key)),
    ),

  approvePayoutRun: (runId) =>
    attempt(async () => toPayoutRunDetail(await postPayoutRunApprove(runId))),

  releasePayoutRun: (runId, releases, key) =>
    attempt(async () =>
      toPayoutRunDetail(
        await postPayoutRunRelease(runId, toPayoutRunReleaseRequest(releases), key),
      ),
    ),

  releasePayout: (release, key) =>
    attempt(async () =>
      toPayout(await postPayoutRelease(release.payoutId, { utr_ref: release.utrRef }, key)),
    ),

  commandPayout: (payoutId, command, reason, key) =>
    attempt(async () => toPayout(await postPayoutCommand(payoutId, command, { reason }, key))),

  listStatements: (params) =>
    attempt(async () => toPage(await getStatements(params), toPlatformStatement)),

  issueStatements: (month, key) =>
    attempt(async () => toStatementIssueResult(await postStatementIssue({ period: month }, key))),

  statementPdf: (statement) =>
    attempt(async () => {
      const pdf = await getStatementPdf(statement.id);
      return 'url' in pdf
        ? { kind: 'url' as const, url: pdf.url, statementNo: statement.statementNo }
        : {
            kind: 'file' as const,
            file: { blob: pdf.blob, filename: `${safeFilename(statement.statementNo)}.pdf` },
          };
    }),

  exportPeriods: (format, filter) =>
    attempt(async () => ({
      blob: await getSettlementsExport(format, filter),
      filename: `medibook-settlements.${format}`,
    })),
};
