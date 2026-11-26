import { z } from 'zod';

import type {
  DisplayBoard,
  DisplayGrant,
  DisplaySession,
} from '@/features/display/domain/entities/display.types';

/** `POST /display/auth` — `{access, token_type, expires_in, expires_at, device}`. */
export const displayAuthResponseSchema = z.object({
  access: z.string(),
  expires_at: z.string(),
  device: z.object({ name: z.string().nullish() }).passthrough(),
});

const tokenSchema = z.object({ label: z.string().nullish(), token_no: z.number().nullish() });

const sessionRowSchema = z.object({
  session: z.object({
    id: z.string(),
    label: z.string().nullish(),
    status: z.string().nullish(),
  }),
  doctor: z.object({
    id: z.string().nullish(),
    name: z.string().nullish(),
    room: z.string().nullish(),
  }),
  counter: z.object({ code: z.string().nullish() }).nullish(),
  current_token: tokenSchema.nullish(),
  current_patient_display_name: z.string().nullish(),
  last_called: z.object({ token_no: z.number().nullish(), at: z.string().nullish() }).nullish(),
  waiting_count: z.number().nullish(),
  queue_state: z.string().nullish(),
});

const offTodaySchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  room: z.string().nullish(),
  status: z.string().nullish(),
});

/**
 * `GET /display/queue` — see `tokens/services/display_queue.py` `build()`. The admin's preview
 * (`/hospital/display-devices/…preview`) answers with the same body. `department` is sent by
 * backends with per-department screens (client feedback point 8); the hospital logo and
 * `doctors_off_today` by backends with the redrawn board (point 7). Older ones omit them.
 */
export const displayQueueResponseSchema = z.object({
  hospital: z.object({
    name: z.string().nullish(),
    logo_file_id: z.string().nullish(),
    logo_url: z.string().nullish(),
  }),
  department: z.object({ name: z.string().nullish() }).nullish(),
  date: z.string(),
  sessions: z.array(sessionRowSchema),
  doctors_off_today: z.array(offTodaySchema).nullish(),
});

export type DisplayAuthResponse = z.infer<typeof displayAuthResponseSchema>;
export type DisplayQueueResponse = z.infer<typeof displayQueueResponseSchema>;

export function toDisplayGrant(dto: DisplayAuthResponse): DisplayGrant {
  return {
    accessToken: dto.access,
    expiresAt: dto.expires_at,
    deviceName: dto.device.name ?? '',
  };
}

function toSession(row: z.infer<typeof sessionRowSchema>): DisplaySession {
  const current = row.current_token ?? null;
  return {
    id: row.session.id,
    label: row.session.label ?? '',
    status: row.session.status ?? 'scheduled',
    queueState: row.queue_state ?? '',
    doctorId: row.doctor.id ?? '',
    doctorName: row.doctor.name ?? '',
    room: row.doctor.room ?? null,
    counterCode: row.counter?.code ?? null,
    currentToken: current?.label ?? (current?.token_no != null ? String(current.token_no) : null),
    currentTokenNo: current?.token_no ?? null,
    currentPatient: row.current_patient_display_name ?? null,
    lastCalledToken: row.last_called?.token_no != null ? String(row.last_called.token_no) : null,
    lastCalledAt: row.last_called?.at ?? null,
    waitingCount: row.waiting_count ?? 0,
  };
}

export function toDisplayBoard(dto: DisplayQueueResponse): DisplayBoard {
  const { logo_file_id: logoFileId, logo_url: logoUrl } = dto.hospital;
  return {
    hospitalName: dto.hospital.name ?? '',
    logo: logoFileId && logoUrl ? { fileId: logoFileId, url: logoUrl } : null,
    departmentName: dto.department?.name || null,
    date: dto.date,
    sessions: dto.sessions.map(toSession),
    doctorsOffToday: (dto.doctors_off_today ?? []).map((d) => ({
      id: d.id,
      name: d.name ?? '',
      room: d.room ?? null,
      status: d.status ?? 'active',
    })),
  };
}
