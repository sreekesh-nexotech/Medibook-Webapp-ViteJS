import type { Result } from '@/core/error/failure';

import type {
  PeriodFilter,
  SettlementExportFormat,
  SettlementFile,
} from '@/features/ops-settlements/domain/entities/opsSettlements.entities';
import { opsSettlementsRepository } from '@/features/ops-settlements/infrastructure/repositories/opsSettlements.repository.impl';

export function exportSettlements(
  format: SettlementExportFormat,
  filter: PeriodFilter,
): Promise<Result<SettlementFile>> {
  return opsSettlementsRepository.exportPeriods(format, filter);
}
