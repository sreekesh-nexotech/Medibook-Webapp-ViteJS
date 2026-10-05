import type { Result } from '@/core/error/failure';

import type { SettlementPeriodDetail } from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsRepository } from '@/features/settlements/infrastructure/repositories/settlements.repository.impl';

export function fetchSettlementPeriod(periodId: string): Promise<Result<SettlementPeriodDetail>> {
  return settlementsRepository.getPeriod(periodId);
}
