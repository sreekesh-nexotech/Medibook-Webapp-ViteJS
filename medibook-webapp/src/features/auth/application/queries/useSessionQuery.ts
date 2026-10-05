import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { authKeys } from '@/features/auth/application/queries/auth.keys';
import { fetchSession } from '@/features/auth/application/usecases/fetchSession';
import { hasStoredSession } from '@/features/auth/application/usecases/hasStoredSession';

/** Who is signed in rarely changes mid-session; permissions are re-read every 5 minutes. */
const SESSION_STALE_TIME_MS = 5 * 60_000;

/**
 * The validated session for `surface` (`GET /<surface>/me`). Idle when the
 * browser holds no tokens for it — check `isIdle` (`fetchStatus === 'idle'`
 * with no data) to tell "signed out" from "loading".
 */
export function useSessionQuery(surface: AuthSurface, enabled = true) {
  return useQuery({
    queryKey: authKeys.session(surface),
    queryFn: async () => unwrap(await fetchSession(surface)),
    enabled: enabled && hasStoredSession(surface),
    staleTime: SESSION_STALE_TIME_MS,
  });
}
