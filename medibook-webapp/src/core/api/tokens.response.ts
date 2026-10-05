import { z } from 'zod';

import type { TokenGrant } from '@/core/api/tokens';

/**
 * `Tokens` — what login, MFA verify and token refresh return on the hospital
 * and platform surfaces (`schema.yml` `components.schemas.Tokens`). `user` is
 * passed through untyped here: the auth feature (F1) owns its shape.
 */
export const tokensResponseSchema = z.object({
  access: z.string().min(1),
  refresh: z.string().min(1),
  access_expires_in: z.number().int().positive(),
  session_id: z.string(),
  user: z.unknown().optional(),
});

export type TokensResponse = z.infer<typeof tokensResponseSchema>;

export function toTokenGrant(dto: TokensResponse): TokenGrant {
  return {
    access: dto.access,
    refresh: dto.refresh,
    accessExpiresIn: dto.access_expires_in,
  };
}
