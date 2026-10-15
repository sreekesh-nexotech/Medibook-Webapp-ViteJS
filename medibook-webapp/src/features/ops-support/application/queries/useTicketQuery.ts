import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { fetchTicket } from '@/features/ops-support/application/usecases/fetchTicket';

/** Requesters answer from the hospital console or the patient app; re-read an open thread every half minute. */
const TICKET_REFRESH_MS = 30_000;

/** One ticket with its thread; idle while `id` is `null`. */
export function useTicketQuery(id: string | null) {
  return useQuery({
    queryKey: supportKeys.detail(id ?? ''),
    queryFn: async () => unwrap(await fetchTicket(id ?? '')),
    enabled: id !== null,
    refetchInterval: TICKET_REFRESH_MS,
  });
}
