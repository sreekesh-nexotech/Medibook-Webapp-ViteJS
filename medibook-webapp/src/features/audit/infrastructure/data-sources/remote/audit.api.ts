import { exportTruncation } from '@/core/api/blobResponses';
import { hospitalApi } from '@/core/api/http';

import type {
  AuditLogFilters,
  AuditLogPageQuery,
} from '@/features/audit/domain/entities/audit.log';
import {
  auditLogExportResponseSchema,
  auditLogPageResponseSchema,
} from '@/features/audit/infrastructure/data-sources/remote/audit.response';

/** The filter query params both endpoints accept; blank filters are left out (no `?q=`). */
function filterParams(filters: AuditLogFilters): Record<string, string> {
  const params: Record<string, string> = { sort: filters.sort };
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  if (filters.actorUserId) params.actor_user_id = filters.actorUserId;
  if (filters.action) params.action = filters.action;
  if (filters.resourceType) params.resource_type = filters.resourceType;
  if (filters.q) params.q = filters.q;
  return params;
}

/** `GET /hospital/audit/log` — one page, newest first unless `sort` says otherwise. */
export async function getAuditLog(query: AuditLogPageQuery) {
  const response = await hospitalApi.get('/audit/log', {
    params: { ...filterParams(query), page: query.page, page_size: query.pageSize },
  });
  return auditLogPageResponseSchema.parse(response.data);
}

/**
 * `GET /hospital/audit/log/export.csv` — same filters as the list, CSV body as
 * text, plus what the headers say about rows left out at the cap (UAT-40).
 */
export async function getAuditLogCsv(filters: AuditLogFilters) {
  const response = await hospitalApi.get('/audit/log/export.csv', {
    params: filterParams(filters),
    responseType: 'text',
  });
  return {
    csv: auditLogExportResponseSchema.parse(response.data),
    truncation: exportTruncation(response.headers),
  };
}
