import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { replyToSupportTicket } from '@/features/ops-support/application/usecases/replyToSupportTicket';
import type { TicketReply } from '@/features/ops-support/domain/entities/support.entities';

interface ReplyInput {
  readonly id: string;
  readonly reply: TicketReply;
}

/** Reply to the requester or add an internal note, then reload the thread. */
export function useReplyToSupportTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reply }: ReplyInput) => unwrap(await replyToSupportTicket(id, reply)),
    onSettled: (_message, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
    },
  });
}
