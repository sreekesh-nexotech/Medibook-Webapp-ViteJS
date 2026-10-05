import type { Result } from '@/core/error/failure';

import type {
  SettlementPeriodFilters,
  SettlementPeriodWindow,
} from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsRepository } from '@/features/settlements/infrastructure/repositories/settlements.repository.impl';

export function fetchSettlementPeriods(
  filters: SettlementPeriodFilters,
): Promise<Result<SettlementPeriodWindow>> {
  return settlementsRepository.listPeriods(filters);
}
