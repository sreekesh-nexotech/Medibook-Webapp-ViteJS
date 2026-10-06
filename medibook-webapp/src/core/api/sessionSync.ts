import { z } from 'zod';

import type { ApiSurface } from '@/core/api/surface';
import type { TokenGrant } from '@/core/api/tokens';
import { adoptRotation, expireSession } from '@/core/api/tokens';

/**
 * Keeps one browser's tabs on the same session (SEC-06, SEC-10).
 *
 * - `rotated`: a tab refreshed its tokens. Every tab still holding the old
 *   refresh token takes the new pair, because sending a rotated-out refresh
 *   token revokes the whole session family (D-12). Duplicated and restored
 *   tabs share a token this way.
 * - `ended`: a tab signed out, or the server ended the session. Every tab
 *   drops the session and returns to sign-in.
 */

const CHANNEL_NAME = 'medibook.session';

const surfaceSchema = z.enum(['hospital', 'platform']);

const messageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('rotated'),
    surface: surfaceSchema,
    previousRefresh: z.string().min(1),
    grant: z.object({
      access: z.string().min(1),
      refresh: z.string().min(1),
      accessExpiresIn: z.number().positive(),
    }),
  }),
  z.object({ type: z.literal('ended'), surface: surfaceSchema }),
]);

type SessionMessage = z.infer<typeof messageSchema>;

const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);

channel?.addEventListener('message', (event: MessageEvent<unknown>) => {
  const parsed = messageSchema.safeParse(event.data);
  if (!parsed.success) return;
  const message = parsed.data;
  if (message.type === 'rotated')
    adoptRotation(message.surface, message.previousRefresh, message.grant);
  else expireSession(message.surface);
});

function post(message: SessionMessage): void {
  channel?.postMessage(message);
}

/** Tell the other tabs that `previousRefresh` was rotated into `grant`. */
export function announceRotation(
  surface: ApiSurface,
  previousRefresh: string,
  grant: TokenGrant,
): void {
  post({ type: 'rotated', surface, previousRefresh, grant });
}

/** Tell the other tabs that the session is over (sign-out or a refused refresh). */
export function announceSessionEnd(surface: ApiSurface): void {
  post({ type: 'ended', surface });
}
