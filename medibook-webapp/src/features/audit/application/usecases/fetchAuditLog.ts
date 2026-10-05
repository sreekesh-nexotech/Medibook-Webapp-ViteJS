import type { Page } from '@/core/api/pagination';
import type { Result } from '@/core/error/failure';

import type { AuditLogEntry, AuditLogPageQuery } from '@/features/audit/domain/entities/audit.log';
import { auditRepository } from '@/features/audit/infrastructure/repositories/audit.repository.impl';

export function fetchAuditLog(query: AuditLogPageQuery): Promise<Result<Page<AuditLogEntry>>> {
  return auditRepository.listLog(query);
}
