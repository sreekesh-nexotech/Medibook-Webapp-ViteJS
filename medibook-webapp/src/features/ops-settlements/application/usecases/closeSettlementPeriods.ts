import type { Result } from '@/core/error/failure';

import type {
  PeriodCloseOutcome,
  PeriodCloseRequest,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

/** `confirm: false` previews (dry run); `true` closes. */
export function closeSettlementPeriods(
  request: PeriodCloseRequest,
  confirm: boolean,
): Promise<Result<PeriodCloseOutcome>> {
  return opsSettlementsRepository.closePeriods(request, confirm);
}
