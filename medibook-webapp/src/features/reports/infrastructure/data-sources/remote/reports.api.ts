import { isAxiosError } from 'axios';

import { hospitalApi } from '@/core/api/http';

import type {
  ReportExportRequest,
  ReportParams,
  ReportQuery,
  ReportSort,
} from '@/features/reports/domain/entities/reports.entities';
import type {
  ReportCatalogResponse,
  ReportExportQueuedResponse,
  ReportResultResponse,
} from '@/features/reports/infrastructure/data-sources/remote/reports.response';
import {
  reportCatalogResponseSchema,
  reportExportQueuedResponseSchema,
  reportResultResponseSchema,
} from '@/features/reports/infrastructure/data-sources/remote/reports.response';

const HTTP_ACCEPTED = 202;

/** `sort=-col` for descending, `sort=col` ascending (`engine._sort`). */
function sortParam(sort: ReportSort | null): Record<string, string> {
  if (!sort) return {};
  return { sort: sort.dir === 'desc' ? `-${sort.key}` : sort.key };
}

/** Only non-blank filters: the engine rejects unknown params, and blank ones mean "any". */
function filterParams(params: ReportParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(params)) {
    if (value.trim() !== '') out[name] = value;
  }
  return out;
}

/** `GET /hospital/reports` — the catalogue. */
export async function getReports(): Promise<ReportCatalogResponse> {
  const response = await hospitalApi.get('/reports');
  return reportCatalogResponseSchema.parse(response.data);
}

/** `GET /hospital/reports/{code}` — one page, KPIs over every filtered row. */
export async function getReport(query: ReportQuery): Promise<ReportResultResponse> {
  const response = await hospitalApi.get(`/reports/${encodeURIComponent(query.code)}`, {
    params: {
      ...filterParams(query.params),
      ...sortParam(query.sort),
      page: query.page,
      page_size: query.pageSize,
    },
  });
  return reportResultResponseSchema.parse(response.data);
}

export type ReportExportResponse =
  | { readonly kind: 'file'; readonly file: Blob }
  | { readonly kind: 'queued'; readonly body: ReportExportQueuedResponse };

/**
 * A blob request's error body is a Blob too, so `toFailure` could not read
 * the backend's `{code, message}` envelope. Decode it back to JSON in place;
 * a body that is not JSON is left as it was.
 */
async function withJsonErrorBody(error: unknown): Promise<unknown> {
  if (isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      error.response.data = JSON.parse(await error.response.data.text());
    } catch {
      // Not JSON (e.g. a proxy's HTML page): toFailure maps it by status alone.
    }
  }
  return error;
}

/**
 * `GET /hospital/reports/{code}/export.{fmt}` — the file (≤ 50k rows), or
 * `202` when the server queues it. Requested as a blob; a 202's JSON body is
 * read back out of that blob.
 */
export async function getReportExport(request: ReportExportRequest): Promise<ReportExportResponse> {
  const response = await hospitalApi
    .get<Blob>(
      `/reports/${encodeURIComponent(request.code)}/export.${encodeURIComponent(request.format)}`,
      {
        params: { ...filterParams(request.params), ...sortParam(request.sort) },
        responseType: 'blob',
      },
    )
    .catch(async (error: unknown) => {
      throw await withJsonErrorBody(error);
    });
  if (response.status === HTTP_ACCEPTED) {
    const body: unknown = JSON.parse(await response.data.text());
    return { kind: 'queued', body: reportExportQueuedResponseSchema.parse(body) };
  }
  return { kind: 'file', file: response.data };
}
