import { attempt } from '@/core/error/attempt';

import type { OpsSettlementsRepository } from '@/features/ops-settlements/domain/repositories/opsSettlements.repository';
import {
  getPayoutRun,
  getPayoutRuns,
  getPeriods,
  postPayoutRelease,
  postPayoutRun,
  postPayoutRunApprove,
  postPayoutRunRelease,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.api';
import {
  toPayoutRunCreateRequest,
  toPayoutRunReleaseRequest,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.request';
import {
  toPayout,
  toPayoutRun,
  toPayoutRunDetail,
  toSettlementPeriod,
} from '@/features/ops-settlements/infrastructure/data-sources/remote/opsSettlements.response';

export const opsSettlementsRepository: OpsSettlementsRepository = {
  listPeriods: (filter) => attempt(async () => (await getPeriods(filter)).map(toSettlementPeriod)),

  listPayoutRuns: () => attempt(async () => (await getPayoutRuns()).map(toPayoutRun)),

  getPayoutRun: (runId) => attempt(async () => toPayoutRunDetail(await getPayoutRun(runId))),

  createPayoutRun: (draft, key) =>
    attempt(async () => toPayoutRun(await postPayoutRun(toPayoutRunCreateRequest(draft), key))),

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
};
