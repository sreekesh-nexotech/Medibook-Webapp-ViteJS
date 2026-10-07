import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  AuditLogEntry,
  AuditLogFilters,
  AuditLogQuery,
  LogsExport,
  RetentionWindow,
} from '@/features/ops-logs/domain/entities/logs.types';

/** The platform-wide audit trail (read-only; `logs.view`). */
export interface LogsRepository {
  /** One page of audit entries matching `query`. */
  getLogs(query: AuditLogQuery): Promise<Result<Page<AuditLogEntry>>>;
  /** The filtered trail as CSV text (server export, B6; capped server side). */
  exportLogsCsv(filters: AuditLogFilters): Promise<Result<LogsExport>>;
  /** The retention windows the backend applies (B6). */
  getRetention(): Promise<Result<RetentionWindow[]>>;
}
