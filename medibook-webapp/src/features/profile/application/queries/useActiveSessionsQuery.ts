import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { AuthSurface } from '@/features/auth/domain/entities/auth.types';
import { profileKeys } from '@/features/profile/application/queries/profile.keys';
import { fetchActiveSessions } from '@/features/profile/application/usecases/fetchActiveSessions';

/** The current user's live sessions on `surface`. */
export function useActiveSessionsQuery(surface: AuthSurface) {
  return useQuery({
    queryKey: profileKeys.sessions(surface),
    queryFn: async () => unwrap(await fetchActiveSessions(surface)),
  });
}
