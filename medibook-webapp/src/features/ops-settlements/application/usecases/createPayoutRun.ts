import type { Result } from '@/core/error/failure';

import type {
  PayoutRun,
  PayoutRunDraft,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function createPayoutRun(
  draft: PayoutRunDraft,
  idempotencyKey: string,
): Promise<Result<PayoutRun>> {
  return opsSettlementsRepository.createPayoutRun(draft, idempotencyKey);
}
