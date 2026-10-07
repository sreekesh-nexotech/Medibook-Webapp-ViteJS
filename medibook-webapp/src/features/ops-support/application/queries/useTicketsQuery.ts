import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { fetchTickets } from '@/features/ops-support/application/usecases/fetchTickets';
import type { TicketListQuery } from '@/features/ops-support/domain/entities/support.entities';

/** A queue staff work through; half a minute keeps it current without hammering the API. */
const TICKETS_STALE_MS = 30_000;

/** One page of tickets (`GET /platform/support/tickets`). */
export function useTicketsQuery(query: TicketListQuery) {
  return useQuery({
    queryKey: supportKeys.list(query),
    queryFn: async () => unwrap(await fetchTickets(query)),
    staleTime: TICKETS_STALE_MS,
    placeholderData: keepPreviousData,
  });
}
