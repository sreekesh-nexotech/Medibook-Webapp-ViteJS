import { hasSession } from '@/core/api/tokens';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';

/**
 * Whether this browser holds tokens for `surface`. Unvalidated — a guard must
 * still confirm the session with `/me` before treating the user as signed in.
 */
export function hasStoredSession(surface: AuthSurface): boolean {
  return hasSession(surface);
}
