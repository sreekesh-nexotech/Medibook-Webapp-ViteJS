import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  SettlementStatement,
  StatementListQuery,
} from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsRepository } from '@/features/settlements/infrastructure/repositories/settlements.repository.impl';

export function fetchStatements(
  query: StatementListQuery,
): Promise<Result<Page<SettlementStatement>>> {
  return settlementsRepository.listStatements(query);
}
