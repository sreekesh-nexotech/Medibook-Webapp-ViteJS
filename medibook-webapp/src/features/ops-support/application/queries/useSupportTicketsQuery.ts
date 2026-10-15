import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { fetchSupportTickets } from '@/features/ops-support/application/usecases/fetchSupportTickets';
import type { TicketListParams } from '@/features/ops-support/domain/entities/support.entities';

/**
 * New tickets arrive by email notification too, so a minute-old list is fine;
 * the inbox refreshes itself every minute while it is open.
 */
const TICKETS_REFRESH_MS = 60_000;

/** One page of tickets. Keeps the previous page on screen while the next loads. */
export function useSupportTicketsQuery(params: TicketListParams) {
  return useQuery({
    queryKey: supportKeys.list(params),
    queryFn: async () => unwrap(await fetchSupportTickets(params)),
    staleTime: TICKETS_REFRESH_MS,
    refetchInterval: TICKETS_REFRESH_MS,
    placeholderData: keepPreviousData,
  });
}
