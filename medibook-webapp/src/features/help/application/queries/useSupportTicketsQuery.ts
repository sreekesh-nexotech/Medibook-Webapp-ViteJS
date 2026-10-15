import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import type { TicketListQuery } from '@/features/help/domain/entities/help.types';
import { helpKeys } from '@/features/help/application/queries/help.keys';
import { fetchSupportTickets } from '@/features/help/application/usecases/fetchSupportTickets';

/** Replies arrive from the Medibook team at any time; re-read the list now and then. */
const TICKETS_STALE_TIME_MS = 30_000;

/** The hospital's support tickets, newest activity first. */
export function useSupportTicketsQuery(query: TicketListQuery) {
  return useQuery({
    queryKey: helpKeys.ticketList(query),
    queryFn: async () => unwrap(await fetchSupportTickets(query)),
    placeholderData: keepPreviousData,
    staleTime: TICKETS_STALE_TIME_MS,
  });
}
