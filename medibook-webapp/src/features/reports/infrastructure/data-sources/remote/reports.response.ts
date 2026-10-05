import { z } from 'zod';

import type {
  ReportColumnDef,
  ReportDefinition,
  ReportKpiValue,
  ReportResult,
  ReportRow,
  ReportValue,
  ReportValueKind,
} from '@/features/reports/domain/entities/reports.entities';

/**
 * Report envelopes from the backend's report engine
 * (`reports/services/engine.py` — `ReportSpec.summary()` and `run()`);
 * `schema.yml` types them only as `object`.
 */

const PAISE_PER_RUPEE = 100;

const valueKindSchema = z.enum([
  'str',
  'int',
  'paise',
  'bp',
  'percent',
  'date',
  'datetime',
  'bool',
]);

const valueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const columnSchema = z.object({ key: z.string(), label: z.string(), kind: valueKindSchema });

const filterSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: z.enum(['date_range', 'uuid', 'choice', 'str']),
  params: z.array(z.string()),
  choices: z.array(z.string()).optional(),
});

const definitionSchema = z.object({
  code: z.string(),
  title: z.string(),
  filters: z.array(filterSchema),
  columns: z.array(columnSchema),
  formats: z.array(z.enum(['csv', 'xlsx', 'pdf'])),
  notes: z.array(z.string()),
});

/** `GET /hospital/reports` → `{results, total}` (not paginated: 14 entries). */
export const reportCatalogResponseSchema = z.object({
  results: z.array(definitionSchema),
  total: z.number().int(),
});

/** `GET /hospital/reports/{code}`. */
export const reportResultResponseSchema = z.object({
  code: z.string(),
  title: z.string(),
  kpis: z.array(
    z.object({ key: z.string(), label: z.string(), kind: valueKindSchema, value: valueSchema }),
  ),
  columns: z.array(columnSchema),
  rows: z.array(z.record(z.string(), valueSchema)),
  page: z.object({
    page: z.number().int(),
    page_size: z.number().int(),
    total: z.number().int(),
    has_next: z.boolean(),
  }),
  meta: z.object({ notes: z.array(z.string()) }),
});

/** `202` from an export above the synchronous row limit (`reports/services/exports.py`). */
export const reportExportQueuedResponseSchema = z.object({
  status: z.literal('processing'),
  export_id: z.string(),
  rows: z.number().int(),
});

type ValueKindDto = z.infer<typeof valueKindSchema>;
type ColumnDto = z.infer<typeof columnSchema>;
export type ReportCatalogResponse = z.infer<typeof reportCatalogResponseSchema>;
export type ReportResultResponse = z.infer<typeof reportResultResponseSchema>;
export type ReportExportQueuedResponse = z.infer<typeof reportExportQueuedResponseSchema>;

function toKind(kind: ValueKindDto): ReportValueKind {
  return kind === 'paise' ? 'rupees' : kind;
}

/** Paise → rupees for money values; everything else passes through. */
function toValue(value: ReportValue, kind: ValueKindDto): ReportValue {
  return kind === 'paise' && typeof value === 'number' ? value / PAISE_PER_RUPEE : value;
}

function toColumn(dto: ColumnDto): ReportColumnDef {
  return { key: dto.key, label: dto.label, kind: toKind(dto.kind) };
}

export function toReportCatalog(dto: ReportCatalogResponse): readonly ReportDefinition[] {
  return dto.results.map((r) => ({
    code: r.code,
    title: r.title,
    filters: r.filters.map((f) => ({
      key: f.key,
      label: f.label,
      kind: f.kind,
      params: f.params,
      choices: f.choices ?? [],
    })),
    columns: r.columns.map(toColumn),
    formats: r.formats,
    notes: r.notes,
  }));
}

export function toReportResult(dto: ReportResultResponse): ReportResult {
  const kinds = new Map(dto.columns.map((c) => [c.key, c.kind]));
  const rows: ReportRow[] = dto.rows.map((row) => {
    const out: Record<string, ReportValue> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = toValue(value, kinds.get(key) ?? 'str');
    }
    return out;
  });
  const kpis: ReportKpiValue[] = dto.kpis.map((k) => ({
    key: k.key,
    label: k.label,
    kind: toKind(k.kind),
    value: toValue(k.value, k.kind),
  }));
  return {
    code: dto.code,
    title: dto.title,
    kpis,
    columns: dto.columns.map(toColumn),
    rows,
    page: dto.page.page,
    pageSize: dto.page.page_size,
    total: dto.page.total,
    hasNext: dto.page.has_next,
    notes: dto.meta.notes,
  };
}
