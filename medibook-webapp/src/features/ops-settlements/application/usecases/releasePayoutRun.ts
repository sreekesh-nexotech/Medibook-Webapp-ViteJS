import type { Result } from '@/core/error/failure';

import type {
  PayoutRelease,
  PayoutRunDetail,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function releasePayoutRun(
  runId: string,
  releases: readonly PayoutRelease[],
  idempotencyKey: string,
): Promise<Result<PayoutRunDetail>> {
  return opsSettlementsRepository.releasePayoutRun(runId, releases, idempotencyKey);
}
