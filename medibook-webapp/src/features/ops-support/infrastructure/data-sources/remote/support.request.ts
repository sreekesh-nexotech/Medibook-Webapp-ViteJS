import type {
  TicketChanges,
  TicketListParams,
  TicketReply,
} from '@/features/ops-support/domain/entities/support.entities';

/** Query string for `GET /platform/support/tickets` (`views/platform_ticket_list.py` filters). */
export interface TicketListQuery {
  readonly page: number;
  readonly page_size: number;
  readonly sort: string;
  readonly status?: string;
  readonly priority?: string;
  readonly category?: string;
  readonly ticket_no?: string;
}

export function toTicketListQuery(params: TicketListParams): TicketListQuery {
  const ticketNo = params.ticketNo.trim().toUpperCase();
  return {
    page: params.page,
    page_size: params.pageSize,
    sort: params.sort,
    ...(params.statuses.length > 0 ? { status: params.statuses.join(',') } : {}),
    ...(params.priority ? { priority: params.priority } : {}),
    ...(params.category ? { category: params.category } : {}),
    ...(ticketNo ? { ticket_no: ticketNo } : {}),
  };
}

/** `TicketUpdateSerializer` — only the fields being changed. */
export interface TicketUpdateRequest {
  readonly status?: string;
  readonly priority?: string;
  readonly assigned_to_id?: string | null;
}

export function toTicketUpdateRequest(changes: TicketChanges): TicketUpdateRequest {
  return {
    ...(changes.status ? { status: changes.status } : {}),
    ...(changes.priority ? { priority: changes.priority } : {}),
    ...(changes.assigneeId !== undefined ? { assigned_to_id: changes.assigneeId } : {}),
  };
}

/** `TicketMessageSerializer`. */
export interface TicketMessageRequest {
  readonly body: string;
  readonly is_internal: boolean;
}

export function toTicketMessageRequest(reply: TicketReply): TicketMessageRequest {
  return { body: reply.body.trim(), is_internal: reply.internal };
}
