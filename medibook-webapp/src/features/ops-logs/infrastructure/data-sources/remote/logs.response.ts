import { z } from 'zod';

import { paginatedSchema, toPage } from '@/core/api/pagination';
import type { Page } from '@/core/api/pagination';

import type { AuditLogEntry } from '@/features/ops-logs/domain/entities/logs.types';

/**
 * One `audit_log` row (backend `AuditLogSerializer`). `before` / `after` /
 * `diff` / `meta` are free-form JSON the screen does not show, so they are
 * left out and stripped by Zod.
 */
const auditLogResponseSchema = z.object({
  id: z.string(),
  occurred_at: z.string(),
  request_id: z.string(),
  principal: z.string(),
  actor_user_id: z.string().nullable(),
  hospital_id: z.string().nullable(),
  ip: z.string().nullable(),
  method: z.string(),
  path: z.string(),
  action: z.string(),
  resource_type: z.string(),
  resource_id: z.string().nullable(),
  status_code: z.number().int(),
});

/**
 * `GET /platform/logs` is paginated by `core/pagination.paginate` — the
 * schema.yml entry documents a bare array, but the view returns the standard
 * `{results, page, page_size, total, has_next}` envelope.
 */
export const logsPageResponseSchema = paginatedSchema(auditLogResponseSchema);

export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;
export type LogsPageResponse = z.infer<typeof logsPageResponseSchema>;

function toAuditLogEntry(dto: AuditLogResponse): AuditLogEntry {
  return {
    id: dto.id,
    occurredAt: dto.occurred_at,
    requestId: dto.request_id,
    principal: dto.principal,
    actorUserId: dto.actor_user_id,
    hospitalId: dto.hospital_id,
    ip: dto.ip,
    method: dto.method,
    path: dto.path,
    action: dto.action,
    resourceType: dto.resource_type,
    resourceId: dto.resource_id,
    statusCode: dto.status_code,
  };
}

export function toLogsPage(dto: LogsPageResponse): Page<AuditLogEntry> {
  return toPage(dto, toAuditLogEntry);
}
