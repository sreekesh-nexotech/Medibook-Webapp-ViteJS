import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type {
  AuditLogEntry,
  AuditLogExport,
  AuditLogFilters,
  AuditLogPageQuery,
} from '@/features/audit/domain/entities/audit.log';

/** The hospital's own audit log — read-only. */
export interface AuditRepository {
  listLog(query: AuditLogPageQuery): Promise<Result<Page<AuditLogEntry>>>;
  /** The server-rendered CSV for `filters` (capped at 10,000 rows by the backend). */
  exportLog(filters: AuditLogFilters): Promise<Result<AuditLogExport>>;
}
