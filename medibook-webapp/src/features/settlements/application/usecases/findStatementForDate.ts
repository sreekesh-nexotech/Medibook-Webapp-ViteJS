import type { Result } from '@/core/error/failure';

import type { SettlementStatement } from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsRepository } from '@/features/settlements/infrastructure/repositories/settlements.repository.impl';

/** The statement of the month containing `date` (`null` = not issued yet). */
export function findStatementForDate(date: string): Promise<Result<SettlementStatement | null>> {
  return settlementsRepository.findStatementForDate(date);
}
