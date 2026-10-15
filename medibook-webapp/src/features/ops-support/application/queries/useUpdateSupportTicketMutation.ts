import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { updateSupportTicket } from '@/features/ops-support/application/usecases/updateSupportTicket';
import type { TicketChanges } from '@/features/ops-support/domain/entities/support.entities';

interface UpdateTicketInput {
  readonly id: string;
  readonly changes: TicketChanges;
  readonly version: number;
}

/**
 * Change a ticket's status, priority or assignee; the answer replaces the
 * ticket on screen. When the change is refused (someone else changed the
 * ticket first), the ticket is reloaded so the screen shows the latest.
 */
export function useUpdateSupportTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes, version }: UpdateTicketInput) =>
      unwrap(await updateSupportTicket(id, changes, version)),
    onSuccess: (ticket) => {
      queryClient.setQueryData(supportKeys.detail(ticket.id), ticket);
    },
    onError: (_failure, { id }) => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.detail(id) });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: supportKeys.counts() });
    },
  });
}
