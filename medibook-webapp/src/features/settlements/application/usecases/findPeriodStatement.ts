import type { Result } from '@/core/error/failure';

import type { SettlementStatement } from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsRepository } from '@/features/settlements/infrastructure/repositories/settlements.repository.impl';

export function findPeriodStatement(
  periodStart: string,
): Promise<Result<SettlementStatement | null>> {
  return settlementsRepository.findStatement(periodStart);
}
