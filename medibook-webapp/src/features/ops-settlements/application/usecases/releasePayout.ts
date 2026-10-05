import type { Result } from '@/core/error/failure';

import type {
  Payout,
  PayoutRelease,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function releasePayout(
  release: PayoutRelease,
  idempotencyKey: string,
): Promise<Result<Payout>> {
  return opsSettlementsRepository.releasePayout(release, idempotencyKey);
}
