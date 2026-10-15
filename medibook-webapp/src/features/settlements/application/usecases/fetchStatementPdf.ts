import type { Result } from '@/core/error/failure';

import type { StatementPdf } from '@/features/settlements/domain/entities/settlements.entities';
import { settlementsRepository } from '@/features/settlements/infrastructure/repositories/settlements.repository.impl';

export function fetchStatementPdf(statementId: string): Promise<Result<StatementPdf>> {
  return settlementsRepository.getStatementPdf(statementId);
}
