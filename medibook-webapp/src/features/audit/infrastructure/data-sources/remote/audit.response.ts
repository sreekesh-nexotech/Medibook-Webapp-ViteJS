import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  AuditFieldChange,
  AuditLogEntry,
  AuditSnapshotField,
} from '@/features/audit/domain/entities/audit.log';

/**
 * `AuditLog` (`schema.yml`). `schema.yml` declares the list as a plain array,
 * but the view returns the standard page envelope (`core/pagination.py`), so
 * the page schema is what is validated. `before` / `after` / `diff` / `meta`
 * are masked JSON: `diff` (`{field: [old, new]}`) fills the table, the
 * snapshots and `meta` the detail drawer.
 */
export const auditLogResponseSchema = z.object({
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
  before: z.unknown(),
  after: z.unknown(),
  diff: z.record(z.string(), z.unknown()).nullable(),
  status_code: z.number().int(),
  meta: z.unknown(),
});

export const auditLogPageResponseSchema = paginatedSchema(auditLogResponseSchema);

/** `GET /hospital/audit/log/export.csv` — the CSV body as text. */
export const auditLogExportResponseSchema = z.string();

export type AuditLogResponse = z.infer<typeof auditLogResponseSchema>;

/** A diff side as display text: strings as-is, nullish as `null`, the rest as JSON. */
function toDisplayValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/**
 * A snapshot's top-level fields as display text. An object lists its keys; a
 * bare value is one unnamed field; nothing (or an empty object) is no field.
 */
export function toSnapshotFields(value: unknown): readonly AuditSnapshotField[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).map(([field, v]) => ({
      field,
      value: toDisplayValue(v),
    }));
  }
  return [{ field: 'value', value: toDisplayValue(value) }];
}

/** `diff` holds `[before, after]` pairs; anything else is ignored rather than guessed at. */
function toChanges(diff: AuditLogResponse['diff']): readonly AuditFieldChange[] {
  if (!diff) return [];
  const out: AuditFieldChange[] = [];
  for (const [field, pair] of Object.entries(diff)) {
    if (!Array.isArray(pair)) continue;
    const [before, after] = pair as readonly unknown[];
    out.push({ field, before: toDisplayValue(before), after: toDisplayValue(after) });
  }
  return out;
}

export function toAuditLogEntry(dto: AuditLogResponse): AuditLogEntry {
  return {
    id: dto.id,
    occurredAt: dto.occurred_at,
    requestId: dto.request_id,
    principal: dto.principal,
    actorUserId: dto.actor_user_id,
    ip: dto.ip,
    method: dto.method,
    path: dto.path,
    action: dto.action,
    resourceType: dto.resource_type,
    resourceId: dto.resource_id,
    changes: toChanges(dto.diff),
    before: toSnapshotFields(dto.before),
    after: toSnapshotFields(dto.after),
    meta: toSnapshotFields(dto.meta),
    statusCode: dto.status_code,
  };
}
