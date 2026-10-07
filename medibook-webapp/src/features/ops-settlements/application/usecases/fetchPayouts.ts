import type { Result } from '@/core/error/failure';

import type {
  Payout,
  PayoutFilter,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

/** `null` when the backend has no flat payout list. */
export function fetchPayouts(filter: PayoutFilter): Promise<Result<readonly Payout[] | null>> {
  return opsSettlementsRepository.listPayouts(filter);
}
