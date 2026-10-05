import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import {
  DATA_REQUEST_STATUSES,
  LOGIN_RESULTS,
  type ConfigChangeRecord,
  type DataRequest,
  type LoginEvent,
} from '@/features/ops-compliance/domain/entities/compliance.entities';

/** `LoginEvent` (`schema.yml`). */
export const loginEventResponseSchema = z.object({
  id: z.string(),
  user_id: z.string().nullable(),
  identifier: z.string(),
  principal: z.string(),
  hospital_id: z.string().nullable(),
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
  occurred_at: z.string(),
});

/** `DataSubjectRequest` (`schema.yml`). */
export const dataRequestResponseSchema = z.object({
  id: z.string(),
  request_no: z.string(),
  subject_kind: z.enum(['patient', 'hospital_staff', 'hospital']),
  subject_user_id: z.string().nullable(),
  hospital_id: z.string().nullable(),
  kind: z.enum(['export', 'deletion', 'rectification', 'percent']),
  status: z.enum(DATA_REQUEST_STATUSES),
  requested_by_kind: z.string(),
  requested_at: z.string(),
  due_at: z.string(),
  completed_at: z.string().nullable().optional(),
  export_file_id: z.string().nullable(),
  notes: z.string().nullable().optional(),
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
    occurredAt: dto.occurred_at,
  };
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
    requestedAt: dto.requested_at,
    dueAt: dto.due_at,
    completedAt: dto.completed_at ?? null,
    exportFileId: dto.export_file_id,
    notes: dto.notes ?? null,
  };
}
