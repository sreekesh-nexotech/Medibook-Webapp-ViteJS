import { apiFor } from '@/core/api/http';

import type { AuditLogQuery } from '@/features/ops-logs/domain/entities/logs.types';
import type { LogsPageResponse } from '@/features/ops-logs/infrastructure/data-sources/remote/logs.response';
import { logsPageResponseSchema } from '@/features/ops-logs/infrastructure/data-sources/remote/logs.response';

const LOGS_PATH = '/logs';

/** The one column `/platform/logs` sorts by (`audit_log_spec` allowlist). */
const SORT_COLUMN = 'occurred_at';

/** Query params `/platform/logs` accepts; unknown params are a 400 there. */
interface LogsParams {
  readonly page: number;
  readonly page_size: number;
  readonly date_from?: string;
  readonly date_to?: string;
  readonly q?: string;
  readonly sort?: string;
  readonly hospital_id?: string;
}

function toParams(query: AuditLogQuery): LogsParams {
  return {
    page: query.page,
    page_size: query.pageSize,
    ...(query.dateFrom ? { date_from: query.dateFrom } : {}),
    ...(query.dateTo ? { date_to: query.dateTo } : {}),
    ...(query.q ? { q: query.q } : {}),
    ...(query.hospitalId ? { hospital_id: query.hospitalId } : {}),
    ...(query.sortDir ? { sort: query.sortDir === 'asc' ? SORT_COLUMN : `-${SORT_COLUMN}` } : {}),
  };
}

/** `GET /api/v1/platform/logs` — the platform-wide audit trail. */
export async function getLogs(query: AuditLogQuery): Promise<LogsPageResponse> {
  const response = await apiFor('platform').get(LOGS_PATH, { params: toParams(query) });
  return logsPageResponseSchema.parse(response.data);
}
