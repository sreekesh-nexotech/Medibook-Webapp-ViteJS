import { z } from 'zod';

import type {
  QueueSession,
  SkipOutcome,
} from '@/features/token-queue/domain/entities/tokenQueue.entities';

/** `tokens/services/queue.snapshot` — the list rows, every command's answer and the WS push. */
export const sessionSnapshotSchema = z.object({
  id: z.string(),
  doctor_id: z.string(),
  date: z.string(),
  session_code: z.string(),
  label: z.string(),
  status: z.enum(['scheduled', 'open', 'paused', 'closed', 'cancelled']),
  queue_state: z.enum(['available', 'waiting', 'consulting', 'on_break']),
  current_token_no: z.number().int().nullable(),
  current_appointment_id: z.string().nullable(),
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

export type SessionSnapshotResponse = z.infer<typeof sessionSnapshotSchema>;

export function toQueueSession(dto: SessionSnapshotResponse): QueueSession {
  return {
    id: dto.id,
    doctorId: dto.doctor_id,
    date: dto.date,
    sessionCode: dto.session_code,
    label: dto.label,
    status: dto.status,
    queueState: dto.queue_state,
    currentTokenNo: dto.current_token_no,
    currentAppointmentId: dto.current_appointment_id,
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
