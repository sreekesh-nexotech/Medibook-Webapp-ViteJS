import { z } from 'zod';

import type { ActiveSession } from '@/features/profile/domain/entities/profile.types';

/** `UserSession` (`schema.yml`) — `GET /<surface>/auth/sessions` returns a plain array. */
export const activeSessionResponseSchema = z.object({
  id: z.string(),
  user_agent: z.string().nullable(),
  ip: z.string(),
  created_at: z.string(),
  last_seen_at: z.string(),
  current: z.boolean(),
});

export const activeSessionsResponseSchema = z.array(activeSessionResponseSchema);

export type ActiveSessionResponse = z.infer<typeof activeSessionResponseSchema>;

export function toActiveSession(dto: ActiveSessionResponse): ActiveSession {
  return {
    id: dto.id,
    userAgent: dto.user_agent,
    ip: dto.ip,
    createdAt: dto.created_at,
    lastSeenAt: dto.last_seen_at,
    current: dto.current,
  };
}
