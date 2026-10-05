import type { Result } from '@/core/error/failure';

import type {
  PeriodFilter,
  SettlementPeriod,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function fetchSettlementPeriods(
  filter: PeriodFilter,
): Promise<Result<readonly SettlementPeriod[]>> {
  return opsSettlementsRepository.listPeriods(filter);
}
