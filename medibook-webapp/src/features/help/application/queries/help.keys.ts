import type { TicketListQuery } from '@/features/help/domain/entities/help.types';

/** Query keys for Help & Support (standards §4 — no inline key arrays). */
export const helpKeys = {
  all: ['help'] as const,
  /** The hospital's ticket lists (`GET /hospital/support/tickets`). */
  tickets: () => [...helpKeys.all, 'tickets'] as const,
  ticketList: (query: TicketListQuery) => [...helpKeys.tickets(), 'list', query] as const,
  ticket: (id: string) => [...helpKeys.tickets(), 'detail', id] as const,
};
