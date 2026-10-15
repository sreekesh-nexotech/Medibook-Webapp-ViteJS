import { toPage } from '@/core/api/pagination';
import { attempt } from '@/core/error/attempt';

import type { AuditRepository } from '@/features/audit/domain/repositories/audit.repository';
import {
  getAuditLog,
  getAuditLogCsv,
} from '@/features/audit/infrastructure/data-sources/remote/audit.api';
import { toAuditLogEntry } from '@/features/audit/infrastructure/data-sources/remote/audit.response';

/** Download name for the export; the backend's own is `audit-log.csv`. */
const AUDIT_EXPORT_FILENAME = 'medibook-audit-log.csv';

export const auditRepository: AuditRepository = {
  listLog: (query) => attempt(async () => toPage(await getAuditLog(query), toAuditLogEntry)),

  exportLog: (filters) =>
    attempt(async () => {
      const { csv, truncation } = await getAuditLogCsv(filters);
      return {
        filename: AUDIT_EXPORT_FILENAME,
        csv,
        isTruncated: truncation.truncated,
        rowLimit: truncation.rowLimit,
      };
    }),
};
