import type {
  TicketListParams,
  TicketListQuery,
  TicketStatus,
} from '@/features/ops-support/domain/entities/support.entities';

/** Query keys for the support desk and ops support inbox. */
export const supportKeys = {
  all: ['ops-support'] as const,
  lists: () => [...supportKeys.all, 'list'] as const,
  list: (query: TicketListQuery | TicketListParams) => [...supportKeys.lists(), query] as const,
  counts: () => [...supportKeys.all, 'count'] as const,
  count: (statuses: readonly TicketStatus[]) => [...supportKeys.counts(), statuses] as const,
  details: () => [...supportKeys.all, 'detail'] as const,
  detail: (id: string) => [...supportKeys.details(), id] as const,
};
