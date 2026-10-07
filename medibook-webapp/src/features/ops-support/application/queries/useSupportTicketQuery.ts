import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { fetchSupportTicket } from '@/features/ops-support/application/usecases/fetchSupportTicket';

/** A requester can reply while the ticket is open; check for that every 30 seconds. */
const TICKET_REFRESH_MS = 30_000;

/** One ticket with its thread. */
export function useSupportTicketQuery(id: string) {
  return useQuery({
    queryKey: supportKeys.detail(id),
    queryFn: async () => unwrap(await fetchSupportTicket(id)),
    staleTime: TICKET_REFRESH_MS,
    refetchInterval: TICKET_REFRESH_MS,
  });
}
