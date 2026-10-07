import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { NewTicketMessage } from '@/features/help/domain/entities/help.types';
import { helpKeys } from '@/features/help/application/queries/help.keys';
import { replyToSupportTicket } from '@/features/help/application/usecases/replyToSupportTicket';

interface ReplyInput {
  readonly ticketId: string;
  readonly message: NewTicketMessage;
}

/** Reply on a ticket; its thread and the list (status, activity) refresh. */
export function useReplyToTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticketId, message }: ReplyInput) =>
      unwrap(await replyToSupportTicket(ticketId, message)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: helpKeys.tickets() }),
  });
}
