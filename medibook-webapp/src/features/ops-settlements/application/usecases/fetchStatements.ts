import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  PlatformStatement,
  StatementListParams,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function fetchStatements(
  params: StatementListParams,
): Promise<Result<Page<PlatformStatement>>> {
  return opsSettlementsRepository.listStatements(params);
}
