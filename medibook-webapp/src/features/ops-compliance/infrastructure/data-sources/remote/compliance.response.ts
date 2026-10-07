import { z } from 'zod';

import { maskedContactSchema, toContactLine } from '@/core/api/labels.response';
import { paginatedSchema } from '@/core/api/pagination';

import {
  DATA_REQUEST_STATUSES,
  LOGIN_RESULTS,
  type ConfigChangeRecord,
  type DataRequest,
  type DataRequestAction,
  type LoginEvent,
} from '@/features/ops-compliance/domain/entities/compliance.entities';

/** `LoginEvent` (`schema.yml`). */
export const loginEventResponseSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  identifier: z.string(),
  principal: z.string(),
  hospital_id: z.string().nullable(),
  hospital_name: z.string().nullable().optional(),
  result: z.enum(LOGIN_RESULTS),
  ip: z.string(),
  user_agent: z.string().nullable().optional(),
  occurred_at: z.string(),
});

/** `ConfigChange` (`schema.yml`); before/after are arbitrary JSON. */
export const configChangeResponseSchema = z.object({
  id: z.string(),
  scope: z.enum(['platform', 'hospital']),
  hospital_id: z.string().nullable(),
  setting_key: z.string(),
  before_value: z.unknown().optional(),
  after_value: z.unknown().optional(),
  actor_user_id: z.string(),
  actor_name: z.string().nullable().optional(),
  hospital_name: z.string().nullable().optional(),
  occurred_at: z.string(),
});

/** `DataSubjectRequest` (`schema.yml`). */
export const dataRequestResponseSchema = z.object({
  id: z.string(),
  request_no: z.string(),
  subject_kind: z.enum(['patient', 'hospital_staff', 'hospital']),
  subject_user_id: z.string().nullable(),
  hospital_id: z.string().nullable(),
  kind: z.enum(['export', 'deletion', 'rectification']),
  status: z.enum(DATA_REQUEST_STATUSES),
  requested_by_kind: z.string(),
  requested_by_id: z.string().nullable().optional(),
  requested_at: z.string(),
  cooling_off_ends_at: z.string().nullable().optional(),
  due_at: z.string(),
  completed_at: z.string().nullable().optional(),
  export_file_id: z.string().nullable(),
  notes: z.string().nullable().optional(),
  retention_carve_out: z.unknown().optional(),
  // B6 (BE-30): names on compliance rows; absent on older backends.
  subject_name: z.string().nullable().optional(),
  subject_contact: maskedContactSchema,
  hospital_name: z.string().nullable().optional(),
  requested_by_name: z.string().nullable().optional(),
  // B6 (UAT-54): what may be done now; absent on older backends.
  allowed_actions: z.array(z.string()).optional(),
});

/**
 * The three lists — `schema.yml` documents plain arrays, but every view
 * returns the paginated envelope (`core/pagination.py`).
 */
export const loginEventPageSchema = paginatedSchema(loginEventResponseSchema);
export const configChangePageSchema = paginatedSchema(configChangeResponseSchema);
export const dataRequestPageSchema = paginatedSchema(dataRequestResponseSchema);

export type LoginEventResponse = z.infer<typeof loginEventResponseSchema>;
export type ConfigChangeResponse = z.infer<typeof configChangeResponseSchema>;
export type DataRequestResponse = z.infer<typeof dataRequestResponseSchema>;

export function toLoginEvent(dto: LoginEventResponse): LoginEvent {
  return {
    id: dto.id,
    userId: dto.user_id,
    identifier: dto.identifier,
    principal: dto.principal,
    hospitalId: dto.hospital_id,
    hospitalName: dto.hospital_name ?? null,
    result: dto.result,
    ip: dto.ip,
    userAgent: dto.user_agent ?? null,
    occurredAt: dto.occurred_at,
  };
}

export function toConfigChange(dto: ConfigChangeResponse): ConfigChangeRecord {
  return {
    id: dto.id,
    scope: dto.scope,
    hospitalId: dto.hospital_id,
    settingKey: dto.setting_key,
    beforeValue: dto.before_value ?? null,
    afterValue: dto.after_value ?? null,
    actorUserId: dto.actor_user_id,
    actorName: dto.actor_name ?? null,
    hospitalName: dto.hospital_name ?? null,
    occurredAt: dto.occurred_at,
  };
}

/** The carve-out is `{}` until an export is written; treat that as nothing recorded. */
function toCarveOut(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && Object.keys(value).length === 0) return null;
  return value;
}

export function toDataRequest(dto: DataRequestResponse): DataRequest {
  return {
    id: dto.id,
    requestNo: dto.request_no,
    subjectKind: dto.subject_kind,
    subjectUserId: dto.subject_user_id,
    hospitalId: dto.hospital_id,
    kind: dto.kind,
    status: dto.status,
    requestedByKind: dto.requested_by_kind,
    requestedById: dto.requested_by_id ?? null,
    requestedAt: dto.requested_at,
    coolingOffEndsAt: dto.cooling_off_ends_at ?? null,
    dueAt: dto.due_at,
    completedAt: dto.completed_at ?? null,
    exportFileId: dto.export_file_id,
    notes: dto.notes ?? null,
    retentionCarveOut: toCarveOut(dto.retention_carve_out),
    subjectName: dto.subject_name ?? null,
    subjectContact: toContactLine(dto.subject_contact),
    hospitalName: dto.hospital_name ?? null,
    requestedByName: dto.requested_by_name ?? null,
    allowedActions: dto.allowed_actions ? toActions(dto.allowed_actions) : null,
  };
}

/** Keep the actions this console knows; an unknown one is ignored, not a parse failure. */
function toActions(values: readonly string[]): DataRequestAction[] {
  return values.filter((v): v is DataRequestAction => v === 'process' || v === 'reject');
}
