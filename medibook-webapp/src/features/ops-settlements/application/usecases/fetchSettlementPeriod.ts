import type { Result } from '@/core/error/failure';

import type { SettlementPeriodDetail } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function fetchSettlementPeriod(periodId: string): Promise<Result<SettlementPeriodDetail>> {
  return opsSettlementsRepository.getPeriod(periodId);
}
