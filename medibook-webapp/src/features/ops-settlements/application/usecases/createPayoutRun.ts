import type { Result } from '@/core/error/failure';

import type {
  PayoutRunCreated,
  PayoutRunDraft,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function createPayoutRun(
  draft: PayoutRunDraft,
  idempotencyKey: string,
): Promise<Result<PayoutRunCreated>> {
  return opsSettlementsRepository.createPayoutRun(draft, idempotencyKey);
}
