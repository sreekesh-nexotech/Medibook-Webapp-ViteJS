import type { AuditLogPageQuery } from '@/features/audit/domain/entities/audit.log';

/** Query keys for the hospital audit log (standards §4 — no inline key arrays). */
export const auditKeys = {
  all: ['audit'] as const,
  logs: () => [...auditKeys.all, 'log'] as const,
  log: (query: AuditLogPageQuery) => [...auditKeys.logs(), query] as const,
};
