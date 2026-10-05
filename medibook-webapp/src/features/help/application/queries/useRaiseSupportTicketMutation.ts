import { useMutation, useQueryClient } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { NewSupportTicket } from '@/features/help/domain/entities/help.types';
import { helpKeys } from '@/features/help/application/queries/help.keys';
import { raiseSupportTicket } from '@/features/help/application/usecases/raiseSupportTicket';

/** Raise a support ticket; the hospital's ticket list is stale afterwards. */
export function useRaiseSupportTicketMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewSupportTicket) => unwrap(await raiseSupportTicket(input)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: helpKeys.tickets() }),
  });
}
