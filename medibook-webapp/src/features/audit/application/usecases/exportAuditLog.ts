import type { Result } from '@/core/error/failure';

import type { AuditLogExport, AuditLogFilters } from '@/features/audit/domain/entities/audit.log';
import { auditRepository } from '@/features/audit/infrastructure/repositories/audit.repository.impl';

export function exportAuditLog(filters: AuditLogFilters): Promise<Result<AuditLogExport>> {
  return auditRepository.exportLog(filters);
}
