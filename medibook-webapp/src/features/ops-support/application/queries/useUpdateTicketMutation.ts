import { useMutation, useQueryClient } from '@tanstack/react-query';

import { isFailure, unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { updateTicket } from '@/features/ops-support/application/usecases/updateTicket';
import type { TicketChanges } from '@/features/ops-support/domain/entities/support.entities';

interface UpdateTicketInput {
  readonly id: string;
  readonly changes: TicketChanges;
  readonly version: number;
}

/**
 * Change a ticket's status, priority or assignee. The answer is the fresh
 * ticket, written straight into its detail cache; the lists refetch. On a
 * conflict (someone else changed it first) the detail is re-read so the next
 * attempt carries the current version.
 */
export function useUpdateTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes, version }: UpdateTicketInput) =>
      unwrap(await updateTicket(id, changes, version)),
    onSuccess: (ticket) => {
      queryClient.setQueryData(supportKeys.detail(ticket.id), ticket);
    },
    onError: (error, { id }) => {
      if (isFailure(error) && error.kind === 'conflict') {
        void queryClient.invalidateQueries({ queryKey: supportKeys.detail(id) });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
    },
  });
}
