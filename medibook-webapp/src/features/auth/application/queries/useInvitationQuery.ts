import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { authKeys } from '@/features/auth/application/queries/auth.keys';
import { previewInvitation } from '@/features/auth/application/usecases/previewInvitation';

/** The invitation an emailed link points at. `token` empty → idle. */
export function useInvitationQuery(token: string) {
  return useQuery({
    queryKey: authKeys.invitation(token),
    queryFn: async () => unwrap(await previewInvitation(token)),
    enabled: token !== '',
    // An invitation is used once; never serve a stale preview after accepting.
    staleTime: 0,
  });
}
