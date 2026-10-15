import type { Result } from '@/core/error/failure';

import type { AuditLogFilters, LogsExport } from '@/features/ops-logs/domain/entities/logs.types';
import { logsRepository } from '@/features/ops-logs/infrastructure/repositories/logs.repository.impl';

export function exportLogsCsv(filters: AuditLogFilters): Promise<Result<LogsExport>> {
  return logsRepository.exportLogsCsv(filters);
}
