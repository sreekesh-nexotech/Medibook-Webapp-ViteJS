import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  OpsReportExport,
  OpsReportResult,
  OpsReportSummary,
  ReportSchedule,
} from '@/features/ops-reports/domain/entities/opsReports.types';

/**
 * `GET /platform/reports*` is untyped in `schema.yml`; these shapes follow the
 * backend's `ReportSpec.summary()`, `engine.run()`, `exports._defer()` and
 * `schedules.serialize()` (`medibook/reports/services/`).
 */

const formatSchema = z.enum(['csv', 'xlsx', 'pdf']);

const kindSchema = z.enum(['str', 'int', 'paise', 'bp', 'percent', 'date', 'datetime', 'bool']);

const columnResponseSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: kindSchema,
});

const filterResponseSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(['date_range', 'uuid', 'choice', 'str']),
  params: z.array(z.string()),
  choices: z.array(z.string()).optional(),
});

export const reportSummaryResponseSchema = z.object({
  code: z.string(),
  title: z.string(),
  // A spec without sheet filters lists bare parameter names instead (engine.summary()).
  filters: z.array(z.union([filterResponseSchema, z.string()])).optional(),
  columns: z.array(columnResponseSchema),
  formats: z.array(formatSchema),
  notes: z.array(z.string()),
});

/** `{results, total}` — the whole catalogue, not paginated. */
export const reportListResponseSchema = z.object({
  results: z.array(reportSummaryResponseSchema),
  total: z.number().int(),
});

const valueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/** `GET /platform/reports/{code}` — `{filters_applied, kpis, columns, rows, page, meta}`. */
export const reportResultResponseSchema = z.object({
  code: z.string(),
  title: z.string(),
  filters_applied: z.record(z.string(), z.unknown()),
  kpis: z.array(
    z.object({ key: z.string(), label: z.string(), kind: kindSchema, value: valueSchema }),
  ),
  columns: z.array(columnResponseSchema),
  rows: z.array(z.record(z.string(), valueSchema)),
  page: z.object({
    page: z.number().int(),
    page_size: z.number().int(),
    total: z.number().int(),
    has_next: z.boolean(),
  }),
  meta: z.object({ notes: z.array(z.string()) }),
});

/** `202` from an export above the synchronous row limit. */
export const reportExportDeferredResponseSchema = z.object({
  status: z.literal('processing'),
  export_id: z.string(),
  file_url: z.string(),
  rows: z.number().int(),
  max_sync_rows: z.number().int(),
});

/** `schedules.serialize()`; B7 adds the version and the last-run fields. */
export const reportScheduleResponseSchema = z.object({
  id: z.string(),
  report_code: z.string(),
  report_title: z.string().nullable().optional(),
  scope: z.enum(['platform', 'hospital']),
  hospital_id: z.string().nullable(),
  cadence: z.enum(['daily', 'weekly']),
  format: formatSchema,
  recipients: z.array(z.string()),
  uses_default_recipients: z.boolean().optional(),
  is_active: z.boolean(),
  last_sent_at: z.string().nullable(),
  last_run_at: z.string().nullable().optional(),
  last_status: z.enum(['sent', 'skipped', 'failed']).nullable().optional(),
  last_error: z.string().nullable().optional(),
  version: z.number().int().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const reportSchedulePageResponseSchema = paginatedSchema(reportScheduleResponseSchema);

export type ReportSummaryResponse = z.infer<typeof reportSummaryResponseSchema>;
export type ReportResultResponse = z.infer<typeof reportResultResponseSchema>;
export type ReportExportDeferredResponse = z.infer<typeof reportExportDeferredResponseSchema>;
export type ReportScheduleResponse = z.infer<typeof reportScheduleResponseSchema>;
export type ReportSchedulePageResponse = z.infer<typeof reportSchedulePageResponseSchema>;

export function toOpsReportSummary(dto: ReportSummaryResponse): OpsReportSummary {
  return {
    code: dto.code,
    title: dto.title,
    filters: (dto.filters ?? []).map((f) =>
      typeof f === 'string'
        ? { key: f, label: f.replaceAll('_', ' '), kind: 'str', params: [f], choices: [] }
        : { ...f, choices: f.choices ?? [] },
    ),
    columns: dto.columns,
    formats: dto.formats,
    notes: dto.notes,
  };
}

export function toOpsReportResult(dto: ReportResultResponse): OpsReportResult {
  return {
    code: dto.code,
    title: dto.title,
    filtersApplied: dto.filters_applied,
    kpis: dto.kpis,
    columns: dto.columns,
    rows: dto.rows,
    page: dto.page.page,
    pageSize: dto.page.page_size,
    total: dto.page.total,
    hasNext: dto.page.has_next,
    notes: dto.meta.notes,
  };
}

export function toDeferredExport(dto: ReportExportDeferredResponse): OpsReportExport {
  return { status: 'processing', exportId: dto.export_id, rows: dto.rows };
}

export function toReportSchedule(dto: ReportScheduleResponse): ReportSchedule {
  return {
    id: dto.id,
    reportCode: dto.report_code,
    reportTitle: dto.report_title ?? null,
    scope: dto.scope,
    hospitalId: dto.hospital_id,
    cadence: dto.cadence,
    format: dto.format,
    recipients: dto.recipients,
    usesDefaultRecipients: dto.uses_default_recipients ?? dto.recipients.length === 0,
    isActive: dto.is_active,
    lastSentAt: dto.last_sent_at,
    lastRunAt: dto.last_run_at ?? null,
    lastStatus: dto.last_status ?? null,
    lastError: dto.last_error ?? null,
    version: dto.version ?? null,
    createdAt: dto.created_at,
  };
}
