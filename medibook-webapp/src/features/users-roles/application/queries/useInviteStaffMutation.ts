import { useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { usersRolesKeys } from '@/features/users-roles/application/queries/usersRoles.keys';
import { inviteStaffMember } from '@/features/users-roles/application/usecases/inviteStaffMember';
import type { StaffInviteDraft } from '@/features/users-roles/domain/entities/usersRoles.types';

/**
 * Invite a new staff member by email. The backend requires an
 * `Idempotency-Key` on this POST; the key is held for the life of the form
 * (one user intent), so re-submitting after a dropped response is deduplicated
 * instead of sending a second invitation, and it rotates once one succeeds.
 */
export function useInviteStaffMutation() {
  const queryClient = useQueryClient();
  const [replayKey, setReplayKey] = useState(() => crypto.randomUUID());
  return useMutation({
    mutationFn: async (draft: StaffInviteDraft) =>
      unwrap(await inviteStaffMember(draft, replayKey)),
    onSuccess: () => setReplayKey(crypto.randomUUID()),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: usersRolesKeys.invitations() });
    },
  });
}
