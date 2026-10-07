import { isAxiosError } from 'axios';

import { ifMatch } from '@/core/api/headers';
import { platformApi } from '@/core/api/http';

import type {
  OpsReportFormat,
  OpsReportParams,
  OpsReportRunQuery,
  ReportScheduleChanges,
  ReportScheduleDraft,
  ReportScheduleListQuery,
} from '@/features/ops-reports/domain/entities/opsReports.types';
import type {
  ReportExportDeferredResponse,
  ReportResultResponse,
  ReportScheduleResponse,
  ReportSchedulePageResponse,
  ReportSummaryResponse,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.response';
import {
  reportExportDeferredResponseSchema,
  reportListResponseSchema,
  reportResultResponseSchema,
  reportSchedulePageResponseSchema,
  reportScheduleResponseSchema,
} from '@/features/ops-reports/infrastructure/data-sources/remote/opsReports.response';

/** `202 Accepted` — the export is too large to render in the request. */
const HTTP_ACCEPTED = 202;

const CONTENT_DISPOSITION_HEADER = 'content-disposition';

/** `attachment; filename="revenue.csv"` → `revenue.csv`. */
const FILENAME_PATTERN = /filename="?([^";]+)"?/i;

const SCHEDULES_PATH = '/report-schedules';

/** A synchronous export, or the body of a deferred (`202`) one. */
export type ReportExportResponse =
  | { readonly kind: 'file'; readonly filename: string; readonly blob: Blob }
  | { readonly kind: 'deferred'; readonly body: ReportExportDeferredResponse };

/** Filter values worth sending: blank ones are left out (unknown params are a 400). */
export function cleanParams(params: OpsReportParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .map(([k, v]) => [k, v.trim()] as const)
      .filter(([, v]) => v !== ''),
  );
}

/** `GET /platform/reports` — every registered platform report with its filters. */
export async function getReports(): Promise<ReportSummaryResponse[]> {
  const response = await platformApi.get('/reports');
  return reportListResponseSchema.parse(response.data).results;
}

/** `GET /platform/reports/{code}` — KPIs over the filtered rows and one page of them. */
export async function getReport(query: OpsReportRunQuery): Promise<ReportResultResponse> {
  const response = await platformApi.get(`/reports/${encodeURIComponent(query.code)}`, {
    params: {
      ...cleanParams(query.params),
      page: query.page,
      page_size: query.pageSize,
      ...(query.sort ? { sort: query.sort } : {}),
    },
  });
  return reportResultResponseSchema.parse(response.data);
}

/** A JSON body read as text; the raw text when it is not JSON (e.g. a proxy's HTML page). */
function parseTextBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function filenameFrom(disposition: unknown, code: string, fmt: OpsReportFormat): string {
  const match = typeof disposition === 'string' ? FILENAME_PATTERN.exec(disposition) : null;
  return match?.[1] ?? `${code}.${fmt}`;
}

/**
 * `GET /platform/reports/{code}/export.{csv|xlsx|pdf}` with the same filters
 * as the run (Q143). Read as a Blob because a `200` is the file itself; a
 * `202` and every error are JSON in that same body, so they are decoded back
 * here for the deferred export and for `toFailure` to read the backend's
 * message (e.g. a date range over the allowed span, B7).
 */
export async function getReportExport(
  code: string,
  fmt: OpsReportFormat,
  params: OpsReportParams,
): Promise<ReportExportResponse> {
  try {
    const response = await platformApi.get<Blob>(
      `/reports/${encodeURIComponent(code)}/export.${fmt}`,
      { params: cleanParams(params), responseType: 'blob' },
    );
    if (response.status === HTTP_ACCEPTED) {
      return {
        kind: 'deferred',
        body: reportExportDeferredResponseSchema.parse(parseTextBody(await response.data.text())),
      };
    }
    return {
      kind: 'file',
      filename: filenameFrom(response.headers[CONTENT_DISPOSITION_HEADER], code, fmt),
      blob: response.data,
    };
  } catch (error) {
    if (isAxiosError(error) && error.response && error.response.data instanceof Blob) {
      error.response.data = parseTextBody(await error.response.data.text());
    }
    throw error;
  }
}

/* ---------------------------------------------------------------- schedules */

/** `GET /platform/report-schedules` (`reports.edit`, even to read). */
export async function getReportSchedules(
  query: ReportScheduleListQuery,
): Promise<ReportSchedulePageResponse> {
  const response = await platformApi.get(SCHEDULES_PATH, {
    params: {
      page: query.page,
      page_size: query.pageSize,
      sort: '-created_at',
      ...(query.scope ? { scope: query.scope } : {}),
      ...(query.activeOnly ? { is_active: 'true' } : {}),
    },
  });
  return reportSchedulePageResponseSchema.parse(response.data);
}

/** `POST /platform/report-schedules` — a platform-scope schedule. */
export async function postReportSchedule(
  draft: ReportScheduleDraft,
): Promise<ReportScheduleResponse> {
  const response = await platformApi.post(SCHEDULES_PATH, {
    report_code: draft.reportCode,
    scope: 'platform',
    cadence: draft.cadence,
    format: draft.format,
    recipients: draft.recipients,
    is_active: draft.isActive,
  });
  return reportScheduleResponseSchema.parse(response.data);
}

/** `PATCH /platform/report-schedules/{id}` + `If-Match` when the row is versioned (B7). */
export async function patchReportSchedule(
  id: string,
  changes: ReportScheduleChanges,
  version: number | null,
): Promise<ReportScheduleResponse> {
  const body = {
    ...(changes.reportCode !== undefined ? { report_code: changes.reportCode } : {}),
    ...(changes.cadence !== undefined ? { cadence: changes.cadence } : {}),
    ...(changes.format !== undefined ? { format: changes.format } : {}),
    ...(changes.recipients !== undefined ? { recipients: changes.recipients } : {}),
    ...(changes.isActive !== undefined ? { is_active: changes.isActive } : {}),
  };
  const response = await platformApi.patch(`${SCHEDULES_PATH}/${encodeURIComponent(id)}`, body, {
    headers: version === null ? {} : ifMatch(version),
  });
  return reportScheduleResponseSchema.parse(response.data);
}
