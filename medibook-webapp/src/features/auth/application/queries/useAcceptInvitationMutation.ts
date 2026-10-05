import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { InvitationAcceptance } from '@/features/auth/domain/entities/auth.types';
import { authKeys } from '@/features/auth/application/queries/auth.keys';
import { syncAuthStore } from '@/features/auth/application/store/auth.roles';
import { acceptInvitation } from '@/features/auth/application/usecases/acceptInvitation';

interface AcceptInvitationInput {
  readonly token: string;
  readonly input: InvitationAcceptance;
}

/** Accept a hospital invitation and sign the new staff member in. */
export function useAcceptInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ token, input }: AcceptInvitationInput) =>
      unwrap(await acceptInvitation(token, input)),
    onSuccess: (session) => {
      queryClient.clear();
      queryClient.setQueryData(authKeys.session(session.surface), session);
      syncAuthStore(session);
    },
  });
}
