import { useQuery } from '@tanstack/react-query';

import { unwrap } from '@/core/error/failure';

import { supportKeys } from '@/features/ops-support/application/queries/support.keys';
import { countSupportTickets } from '@/features/ops-support/application/usecases/countSupportTickets';
import type { TicketStatus } from '@/features/ops-support/domain/entities/support.entities';

const COUNT_REFRESH_MS = 60_000;

/** How many tickets are in `statuses`, for the inbox's count tiles. */
export function useSupportTicketCountQuery(statuses: readonly TicketStatus[]) {
  return useQuery({
    queryKey: supportKeys.count(statuses),
    queryFn: async () => unwrap(await countSupportTickets(statuses)),
    staleTime: COUNT_REFRESH_MS,
    refetchInterval: COUNT_REFRESH_MS,
  });
}
