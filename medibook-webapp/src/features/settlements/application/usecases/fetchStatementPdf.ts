import type { Result } from '@/core/error/failure';

import { settlementsRepository } from '@/features/settlements/infrastructure/repositories/settlements.repository.impl';

export function fetchStatementPdf(statementId: string): Promise<Result<Blob>> {
  return settlementsRepository.getStatementPdf(statementId);
}
