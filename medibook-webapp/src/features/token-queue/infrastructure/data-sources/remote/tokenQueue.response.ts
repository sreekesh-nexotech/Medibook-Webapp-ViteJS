import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  QueueSession,
  SkipOutcome,
  TokenCall,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';

/**
 * `tokens/services/queue.snapshot` — the list rows, every command's answer
 * and the WS push. The fields marked BE-20 / TOK-01 are new in the backend
 * and optional here, so the screen works against an older backend too.
 */
export const sessionSnapshotSchema = z.object({
  id: z.string(),
  doctor_id: z.string(),
  department_id: z.string().nullable().optional(),
  date: z.string(),
  session_code: z.string(),
  label: z.string(),
  status: z.enum(['scheduled', 'open', 'paused', 'closed', 'cancelled']),
  queue_state: z.enum(['available', 'waiting', 'consulting', 'on_break']),
  current_token_no: z.number().int().nullable(),
  current_appointment_id: z.string().nullable(),
  current_token_label: z.string().nullable().optional(),
  consultation_started_at: z.string().nullable().optional(),
  expected_minutes: z.number().int().nullable().optional(),
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

export function toQueueSession(dto: SessionSnapshotResponse): QueueSession {
  return {
    id: dto.id,
    doctorId: dto.doctor_id,
    departmentId: dto.department_id ?? null,
    date: dto.date,
    sessionCode: dto.session_code,
    label: dto.label,
    status: dto.status,
    queueState: dto.queue_state,
    currentTokenNo: dto.current_token_no,
    currentAppointmentId: dto.current_appointment_id,
    currentTokenLabel: dto.current_token_label ?? null,
    consultationStartedAt: dto.consultation_started_at ?? null,
    expectedMinutes: dto.expected_minutes ?? null,
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
