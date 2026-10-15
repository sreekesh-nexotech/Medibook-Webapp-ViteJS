import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { helpKeys } from '@/features/help/application/queries/help.keys';
import { fetchSupportTicket } from '@/features/help/application/usecases/fetchSupportTicket';

/** Re-read an open thread so a reply from the Medibook team shows up. */
const THREAD_REFETCH_MS = 60_000;

/** One ticket with its thread; `null` stays idle. */
export function useSupportTicketQuery(id: string | null) {
  return useQuery({
    queryKey: helpKeys.ticket(id ?? ''),
    queryFn: async () => unwrap(await fetchSupportTicket(id ?? '')),
    enabled: id !== null,
    refetchInterval: THREAD_REFETCH_MS,
  });
}
