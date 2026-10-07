import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  QueueRow,
  QueueRowKind,
  QueueSession,
  SkipOutcome,
  TokenCall,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';

/**
 * `tokens/services/queue.snapshot` — the list rows, every command's answer
 * and the WS push. The fields marked BE-20 / TOK-01 are new in the backend
 * and optional here, so the screen works against an older backend too.
 */
const QUEUE_ROW_KINDS: ReadonlySet<string> = new Set([
  'current',
  'in_consultation',
  'up_next',
  'called',
] satisfies QueueRowKind[]);

function isQueueRowKind(kind: string): kind is QueueRowKind {
  return QUEUE_ROW_KINDS.has(kind);
}

/** B5 `queue[]` row; `kind` stays a string so a new kind is skipped, not fatal. */
export const queueRowSchema = z.object({
  appointment_id: z.string(),
  token_no: z.number().int(),
  token_label: z.string().nullable().optional(),
  status: z.string(),
  kind: z.string(),
  position: z.number().int().nullable().optional(),
  estimated_wait_minutes: z.number().int().nullable().optional(),
  called_at: z.string().nullable().optional(),
  consultation_started_at: z.string().nullable().optional(),
  skip_count: z.number().int().nullable().optional(),
  offer_no_show: z.boolean().nullable().optional(),
  patient_name: z.string().nullable().optional(),
  mrn: z.string().nullable().optional(),
});

export const sessionSnapshotSchema = z.object({
  id: z.string(),
  doctor_id: z.string(),
  department_id: z.string().nullable().optional(),
  department_name: z.string().nullable().optional(),
  date: z.string(),
  session_code: z.string(),
  label: z.string(),
  status: z.enum(['scheduled', 'open', 'paused', 'closed', 'cancelled']),
  queue_state: z.enum(['available', 'waiting', 'consulting', 'on_break']),
  current_token_no: z.number().int().nullable(),
  current_appointment_id: z.string().nullable(),
  current_token_label: z.string().nullable().optional(),
  consultation_started_at: z.string().nullable().optional(),
  expected_consult_minutes: z.number().int().nullable().optional(),
  /** An early spelling of `expected_consult_minutes`. */
  expected_minutes: z.number().int().nullable().optional(),
  no_show_call_attempts: z.number().int().nullable().optional(),
  up_next_count: z.number().int().nullable().optional(),
  queue: z.array(queueRowSchema).nullable().optional(),
  last_called_token_no: z.number().int().nullable(),
  last_called_at: z.string().nullable(),
  served_count: z.number().int(),
  waiting_count: z.number().int(),
  completed_count: z.number().int(),
  no_show_count: z.number().int(),
  version: z.number().int(),
});

/** Skip answers `{session, attempts, offer_no_show}`. */
export const skipResponseSchema = z.object({
  session: sessionSnapshotSchema,
  attempts: z.number().int(),
  offer_no_show: z.boolean(),
});

/**
 * `TokenCallSerializer` (`tokens/serializers/token_call_serializer.py`).
 * `token_label`, `actor_name` and `counter_code` are optional additions.
 */
export const tokenCallSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  appointment_id: z.string(),
  token_no: z.number().int(),
  token_label: z.string().nullable().optional(),
  event: z.enum(['called', 'recalled', 'skipped', 'served', 'no_show', 'cancelled']),
  attempt_no: z.number().int(),
  actor_user_id: z.string().nullable(),
  actor_name: z.string().nullable().optional(),
  counter_id: z.string().nullable(),
  counter_code: z.string().nullable().optional(),
  occurred_at: z.string(),
});

export const tokenCallPageSchema = paginatedSchema(tokenCallSchema);

export type SessionSnapshotResponse = z.infer<typeof sessionSnapshotSchema>;
export type TokenCallResponse = z.infer<typeof tokenCallSchema>;

export type QueueRowResponse = z.infer<typeof queueRowSchema>;

function toQueueRow(dto: QueueRowResponse, kind: QueueRowKind): QueueRow {
  return {
    appointmentId: dto.appointment_id,
    tokenNo: dto.token_no,
    tokenLabel: dto.token_label ?? null,
    status: dto.status,
    kind,
    position: dto.position ?? null,
    estimatedWaitMinutes: dto.estimated_wait_minutes ?? null,
    calledAt: dto.called_at ?? null,
    consultationStartedAt: dto.consultation_started_at ?? null,
    skipCount: dto.skip_count ?? 0,
    offerNoShow: dto.offer_no_show ?? false,
    patientName: dto.patient_name ?? null,
    mrn: dto.mrn ?? null,
  };
}

/** The rows of a known kind, in the server's order. */
export function toQueueRows(rows: readonly QueueRowResponse[]): readonly QueueRow[] {
  return rows.flatMap((row) => (isQueueRowKind(row.kind) ? [toQueueRow(row, row.kind)] : []));
}

export function toQueueSession(dto: SessionSnapshotResponse): QueueSession {
  return {
    id: dto.id,
    doctorId: dto.doctor_id,
    departmentId: dto.department_id ?? null,
    departmentName: dto.department_name ?? null,
    date: dto.date,
    sessionCode: dto.session_code,
    label: dto.label,
    status: dto.status,
    queueState: dto.queue_state,
    currentTokenNo: dto.current_token_no,
    currentAppointmentId: dto.current_appointment_id,
    currentTokenLabel: dto.current_token_label ?? null,
    consultationStartedAt: dto.consultation_started_at ?? null,
    expectedMinutes: dto.expected_consult_minutes ?? dto.expected_minutes ?? null,
    noShowCallAttempts: dto.no_show_call_attempts ?? null,
    upNextCount: dto.up_next_count ?? null,
    queue: dto.queue ? toQueueRows(dto.queue) : null,
    lastCalledTokenNo: dto.last_called_token_no,
    lastCalledAt: dto.last_called_at,
    servedCount: dto.served_count,
    waitingCount: dto.waiting_count,
    completedCount: dto.completed_count,
    noShowCount: dto.no_show_count,
    version: dto.version,
  };
}

export function toSkipOutcome(dto: z.infer<typeof skipResponseSchema>): SkipOutcome {
  return {
    session: toQueueSession(dto.session),
    attempts: dto.attempts,
    offerNoShow: dto.offer_no_show,
  };
}

export function toTokenCall(dto: TokenCallResponse): TokenCall {
  return {
    id: dto.id,
    appointmentId: dto.appointment_id,
    tokenNo: dto.token_no,
    tokenLabel: dto.token_label ?? null,
    event: dto.event,
    attemptNo: dto.attempt_no,
    actorName: dto.actor_name ?? null,
    counterCode: dto.counter_code ?? null,
    occurredAt: dto.occurred_at,
  };
}
