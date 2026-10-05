import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { messagingKeys } from '@/features/messaging/application/queries/messaging.keys';
import { sendMessage } from '@/features/messaging/application/usecases/sendMessage';
import type { MessageSendInput } from '@/features/messaging/domain/entities/messaging.entities';

/** Queue a message for one appointment; the outbox picks up the new deliveries. */
export function useSendMessageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: MessageSendInput) => unwrap(await sendMessage(input)),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: messagingKeys.deliveries() });
    },
  });
}
