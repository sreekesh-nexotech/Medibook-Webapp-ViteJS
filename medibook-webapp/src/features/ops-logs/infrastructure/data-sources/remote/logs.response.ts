import { z } from 'zod';

import { maskedContactSchema, toContactLine } from '@/core/api/labels.response';
import { paginatedSchema, toPage } from '@/core/api/pagination';
import type { Page } from '@/core/api/pagination';

import type {
  AuditFieldChange,
  AuditLogEntry,
  LogSeverity,
  RetentionWindow,
} from '@/features/ops-logs/domain/entities/logs.types';

const SEVERITIES: readonly LogSeverity[] = ['info', 'warning', 'critical'];

/**
 * One `audit_log` row (backend `AuditLogSerializer`). `before` / `after` /
 * `diff` / `meta` are free-form JSON shown in the entry drawer. `module`,
 * `severity` and the actor and hospital names are added by B6/B9: optional,
 * so an older backend still parses and the screen falls back to ids.
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
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  diff: z.unknown().optional(),
  meta: z.unknown().optional(),
  module: z.string().nullable().optional(),
  severity: z.string().nullable().optional(),
  actor_name: z.string().nullable().optional(),
  actor_email: z.string().nullable().optional(),
  actor_contact: maskedContactSchema,
  hospital_name: z.string().nullable().optional(),
});

/**
 * `GET /platform/logs` is paginated by `core/pagination.paginate` — the
 * schema.yml entry documents a bare array, but the view returns the standard
 * `{results, page, page_size, total, has_next}` envelope.
 */
export const logsPageResponseSchema = paginatedSchema(auditLogResponseSchema);

/** `GET /platform/logs/export.csv` (B6) — the CSV body as text. */
export const logsExportResponseSchema = z.string();

/** `GET /platform/compliance/retention` (B6, `logs.view`). */
export const retentionResponseSchema = z.object({
  policies: z.array(
    z.object({
      table: z.string(),
      label: z.string(),
      retention_days: z.number(),
      retention_years: z.number(),
    }),
  ),
  basis: z.string().optional(),
});

export type RetentionResponse = z.infer<typeof retentionResponseSchema>;

export function toRetentionWindows(dto: RetentionResponse): RetentionWindow[] {
  return dto.policies.map((p) => ({
    table: p.table,
    label: p.label,
    retentionDays: p.retention_days,
    retentionYears: p.retention_years,
  }));
}

export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;
export type LogsPageResponse = z.infer<typeof logsPageResponseSchema>;

/** A diff side as display text: strings as-is, nullish as `null`, the rest as JSON. */
function toDisplayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * `diff` holds `{field: [before, after]}` pairs (backend `audit/services/record.py`);
 * anything else is ignored rather than guessed at — the drawer still shows
 * the raw before/after.
 */
export function toChanges(diff: unknown): readonly AuditFieldChange[] {
  if (typeof diff !== 'object' || diff === null || Array.isArray(diff)) return [];
  const out: AuditFieldChange[] = [];
  for (const [field, pair] of Object.entries(diff)) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [before, after] = pair as readonly unknown[];
    out.push({ field, before: toDisplayValue(before), after: toDisplayValue(after) });
  }
  return out;
}

function toSeverity(value: string | null | undefined): LogSeverity | null {
  const lower = value?.toLowerCase();
  return SEVERITIES.find((s) => s === lower) ?? null;
}

export function toAuditLogEntry(dto: AuditLogResponse): AuditLogEntry {
  return {
    id: dto.id,
    occurredAt: dto.occurred_at,
    requestId: dto.request_id,
    principal: dto.principal,
    actorUserId: dto.actor_user_id,
    actorName: dto.actor_name ?? null,
    actorEmail: dto.actor_email ?? toContactLine(dto.actor_contact),
    hospitalId: dto.hospital_id,
    hospitalName: dto.hospital_name ?? null,
    ip: dto.ip,
    method: dto.method,
    path: dto.path,
    action: dto.action,
    resourceType: dto.resource_type,
    resourceId: dto.resource_id,
    statusCode: dto.status_code,
    module: dto.module ?? null,
    severity: toSeverity(dto.severity),
    before: dto.before ?? null,
    after: dto.after ?? null,
    changes: toChanges(dto.diff),
    meta: dto.meta ?? null,
  };
}

export function toLogsPage(dto: LogsPageResponse): Page<AuditLogEntry> {
  return toPage(dto, toAuditLogEntry);
}
