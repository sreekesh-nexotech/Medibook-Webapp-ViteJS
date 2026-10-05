import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type { AuditLogEntry, AuditLogQuery } from '@/features/ops-logs/domain/entities/logs.types';

/** The platform-wide audit trail (read-only; `logs.view`). */
export interface LogsRepository {
  /** One page of audit entries matching `query`. */
  getLogs(query: AuditLogQuery): Promise<Result<Page<AuditLogEntry>>>;
}
