import type { Result } from '@/core/error/failure';

import type {
  PlatformStatement,
  StatementPdf,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function fetchStatementPdf(statement: PlatformStatement): Promise<Result<StatementPdf>> {
  return opsSettlementsRepository.statementPdf(statement);
}
