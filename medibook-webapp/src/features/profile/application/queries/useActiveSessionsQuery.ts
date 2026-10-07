import { queryOptions, useQuery } from '@tanstack/react-query';

import { hasSession } from '@/core/api/tokens';
import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { profileKeys } from '@/features/profile/application/queries/profile.keys';
import { fetchActiveSessions } from '@/features/profile/application/usecases/fetchActiveSessions';

/**
 * The current user's live sessions on `surface`. Idle once this browser holds
 * no tokens: "Sign out everywhere" drops the cache while the card is still on
 * screen, and the list must not be re-read without a session (UAT R-14).
 */
export function activeSessionsQueryOptions(surface: AuthSurface) {
  return queryOptions({
    queryKey: profileKeys.sessions(surface),
    queryFn: async () => unwrap(await fetchActiveSessions(surface)),
    enabled: hasSession(surface),
  });
}

export function useActiveSessionsQuery(surface: AuthSurface) {
  return useQuery(activeSessionsQueryOptions(surface));
}
