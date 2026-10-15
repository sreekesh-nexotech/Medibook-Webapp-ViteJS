import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { updateTicket } from '@/features/ops-support/application/usecases/updateTicket';
import type { TicketChanges } from '@/features/ops-support/domain/entities/support.entities';

interface UpdateTicketInput {
  readonly id: string;
  readonly changes: TicketChanges;
  readonly version: number;
}

/**
 * Change a ticket's status, priority or assignee. The answer is written
 * straight into the detail cache (new version for the next change), then the
 * detail is re-read anyway — a note posted while the change was in flight may
 * be missing from that answer — and the lists refetch. On a conflict
 * (someone else changed it first) the re-read brings the current version.
 */
export function useUpdateTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, changes, version }: UpdateTicketInput) =>
      unwrap(await updateTicket(id, changes, version)),
    onSuccess: (ticket) => {
      queryClient.setQueryData(supportKeys.detail(ticket.id), ticket);
    },
    onSettled: (_ticket, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
    },
  });
}
