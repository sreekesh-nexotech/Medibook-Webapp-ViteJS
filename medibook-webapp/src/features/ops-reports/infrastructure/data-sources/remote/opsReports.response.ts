import { z } from 'zod';

import type {
  OpsReportExport,
  OpsReportSummary,
} from '@/features/ops-reports/domain/entities/opsReports.types';

/**
 * `GET /platform/reports` is untyped in `schema.yml`; these shapes follow the
 * backend's `ReportSpec.summary()` and `exports._defer()`
 * (`medibook/reports/services/`).
 */

const formatSchema = z.enum(['csv', 'xlsx', 'pdf']);

const columnResponseSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(['str', 'int', 'paise', 'bp', 'percent', 'date', 'datetime', 'bool']),
});

export const reportSummaryResponseSchema = z.object({
  code: z.string(),
  title: z.string(),
  columns: z.array(columnResponseSchema),
  formats: z.array(formatSchema),
  notes: z.array(z.string()),
});

/** `{results, total}` — the whole catalogue, not paginated. */
export const reportListResponseSchema = z.object({
  results: z.array(reportSummaryResponseSchema),
  total: z.number().int(),
});

/** `202` from an export above the synchronous row limit. */
export const reportExportDeferredResponseSchema = z.object({
  status: z.literal('processing'),
  export_id: z.string(),
  file_url: z.string(),
  rows: z.number().int(),
  max_sync_rows: z.number().int(),
});

export type ReportSummaryResponse = z.infer<typeof reportSummaryResponseSchema>;
export type ReportExportDeferredResponse = z.infer<typeof reportExportDeferredResponseSchema>;

export function toOpsReportSummary(dto: ReportSummaryResponse): OpsReportSummary {
  return {
    code: dto.code,
    title: dto.title,
    columns: dto.columns,
    formats: dto.formats,
    notes: dto.notes,
  };
}

export function toDeferredExport(dto: ReportExportDeferredResponse): OpsReportExport {
  return { status: 'processing', exportId: dto.export_id, rows: dto.rows };
}
