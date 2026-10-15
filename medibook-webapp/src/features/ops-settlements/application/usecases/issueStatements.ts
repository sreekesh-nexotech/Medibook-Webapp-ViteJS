import type { Result } from '@/core/error/failure';

import type { StatementIssueResult } from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

/** Issue every hospital's statement for `month` (`YYYY-MM`). */
export function issueStatements(
  month: string,
  idempotencyKey: string,
): Promise<Result<StatementIssueResult>> {
  return opsSettlementsRepository.issueStatements(month, idempotencyKey);
}
