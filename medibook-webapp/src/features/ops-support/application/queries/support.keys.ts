import type { TicketListQuery } from '@/features/ops-support/domain/entities/support.entities';

/** Query keys for the support desk. */
export const supportKeys = {
  all: ['ops-support'] as const,
  lists: () => [...supportKeys.all, 'list'] as const,
  list: (query: TicketListQuery) => [...supportKeys.lists(), query] as const,
  details: () => [...supportKeys.all, 'detail'] as const,
  detail: (id: string) => [...supportKeys.details(), id] as const,
};
