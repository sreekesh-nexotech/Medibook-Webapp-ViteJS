import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { replyToTicket } from '@/features/ops-support/application/usecases/replyToTicket';
import type { TicketReply } from '@/features/ops-support/domain/entities/support.entities';

interface ReplyInput {
  readonly id: string;
  readonly reply: TicketReply;
}

/** Post a reply or an internal note; the thread and the lists (updated time) refetch. */
export function useReplyTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reply }: ReplyInput) => unwrap(await replyToTicket(id, reply)),
    onSuccess: (_message, { id }) => {
      void queryClient.invalidateQueries({ queryKey: supportKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: supportKeys.lists() });
    },
  });
}
