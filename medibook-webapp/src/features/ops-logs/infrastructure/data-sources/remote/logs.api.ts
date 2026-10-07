import { apiFor } from '@/core/api/http';

import type {
  AuditLogFilters,
  AuditLogQuery,
  LogsExport,
} from '@/features/ops-logs/domain/entities/logs.types';
import type {
  LogsPageResponse,
  RetentionResponse,
} from '@/features/ops-logs/infrastructure/data-sources/remote/logs.response';
import {
  logsExportResponseSchema,
  logsPageResponseSchema,
  retentionResponseSchema,
} from '@/features/ops-logs/infrastructure/data-sources/remote/logs.response';

const LOGS_PATH = '/logs';
const LOGS_EXPORT_PATH = '/logs/export.csv';
const RETENTION_PATH = '/compliance/retention';

/** B6 export headers: whether the row cap cut the file, and the cap. */
const TRUNCATED_HEADER = 'x-export-truncated';
const ROW_LIMIT_HEADER = 'x-export-row-limit';

/** The one column `/platform/logs` sorts by (`audit_log_spec` allowlist). */
const SORT_COLUMN = 'occurred_at';

/** Separator for a multi-value filter (`F(many=True)` splits on commas). */
const MULTI_SEPARATOR = ',';

/**
 * The allowlisted query params of `/platform/logs` and its export (unknown
 * params are a 400 there). Blank filters are left out.
 */
export function filterParams(filters: AuditLogFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.dateFrom) params.date_from = filters.dateFrom;
  if (filters.dateTo) params.date_to = filters.dateTo;
  if (filters.q) params.q = filters.q;
  if (filters.actorUserId) params.actor = filters.actorUserId;
  // One principal is valid on every backend; several need B6's multi-value
  // `principal` (BE-30), sent comma-joined.
  if (filters.principals && filters.principals.length > 0) {
    params.principal = filters.principals.join(MULTI_SEPARATOR);
  }
  if (filters.action) params.action = filters.action;
  if (filters.hospitalId) params.hospital_id = filters.hospitalId;
  if (filters.module) params.module = filters.module;
  if (filters.severity) params.severity = filters.severity;
  return params;
}

function pageParams(query: AuditLogQuery): Record<string, string | number> {
  return {
    ...filterParams(query),
    page: query.page,
    page_size: query.pageSize,
    ...(query.sortDir ? { sort: query.sortDir === 'asc' ? SORT_COLUMN : `-${SORT_COLUMN}` } : {}),
  };
}

/** `GET /api/v1/platform/logs` — the platform-wide audit trail. */
export async function getLogs(query: AuditLogQuery): Promise<LogsPageResponse> {
  const response = await apiFor('platform').get(LOGS_PATH, { params: pageParams(query) });
  return logsPageResponseSchema.parse(response.data);
}

/** `GET /api/v1/platform/logs/export.csv` (B6) — the filtered trail as CSV text. */
export async function getLogsCsv(filters: AuditLogFilters): Promise<LogsExport> {
  const response = await apiFor('platform').get(LOGS_EXPORT_PATH, {
    params: { ...filterParams(filters), sort: `-${SORT_COLUMN}` },
    responseType: 'text',
  });
  const limit = Number(response.headers[ROW_LIMIT_HEADER]);
  return {
    csv: logsExportResponseSchema.parse(response.data),
    truncated: String(response.headers[TRUNCATED_HEADER]).toLowerCase() === 'true',
    rowLimit: Number.isInteger(limit) && limit > 0 ? limit : null,
  };
}

/** `GET /platform/compliance/retention` (B6) — the retention windows the backend applies. */
export async function getRetention(): Promise<RetentionResponse> {
  const response = await apiFor('platform').get(RETENTION_PATH);
  return retentionResponseSchema.parse(response.data);
}
