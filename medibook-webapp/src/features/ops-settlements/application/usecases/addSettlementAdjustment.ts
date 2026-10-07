import type { Result } from '@/core/error/failure';

import type {
  AdjustmentDraft,
  SettlementAdjustment,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function addSettlementAdjustment(
  draft: AdjustmentDraft,
  idempotencyKey: string,
): Promise<Result<SettlementAdjustment>> {
  return opsSettlementsRepository.addAdjustment(draft, idempotencyKey);
}
