import type { AuditLogQuery } from '@/features/ops-logs/domain/entities/logs.types';

/** Query keys for the platform audit trail (standards §4 — no inline key arrays). */
export const logsKeys = {
  all: ['ops-logs'] as const,
  lists: () => [...logsKeys.all, 'list'] as const,
  list: (query: AuditLogQuery) => [...logsKeys.lists(), query] as const,
};
