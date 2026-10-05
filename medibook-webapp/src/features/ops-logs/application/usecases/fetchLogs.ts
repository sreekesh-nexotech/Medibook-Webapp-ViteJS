import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type { AuditLogEntry, AuditLogQuery } from '@/features/ops-logs/domain/entities/logs.types';
import { logsRepository } from '@/features/ops-logs/infrastructure/repositories/logs.repository.impl';

export function fetchLogs(query: AuditLogQuery): Promise<Result<Page<AuditLogEntry>>> {
  return logsRepository.getLogs(query);
}
