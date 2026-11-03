import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { authKeys } from '@/features/auth/application/queries/auth.keys';
import { fetchSession } from '@/features/auth/application/usecases/fetchSession';
import { hasStoredSession } from '@/features/auth/application/usecases/hasStoredSession';

/**
 * Permissions are re-read every minute in the background and whenever the tab
 * regains focus after 15 s, so a role change made by an administrator reaches
 * an open session within a minute and without a hard reload (PR-004 /
 * DEF-040); any 403 invalidates them at once (AppProviders).
 */
const SESSION_STALE_TIME_MS = 15_000;
const SESSION_REFETCH_INTERVAL_MS = 60_000;

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
    refetchOnWindowFocus: true,
    refetchInterval: SESSION_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
  });
}
