import type {
  TicketChanges,
  TicketListParams,
  TicketListQuery,
  TicketReply,
} from '@/features/ops-support/domain/entities/support.entities';

/**
 * Query string for `GET /platform/support/tickets` (the view's `FilterSpec`).
 * Multi-value filters go comma-joined; empty ones are left out (an unknown or
 * blank value is a 400).
 */
export function toTicketListParams(query: TicketListQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: query.page,
    page_size: query.pageSize,
    sort: query.sortDir === 'desc' ? `-${query.sort}` : query.sort,
  };
  if (query.statuses.length > 0) params.status = query.statuses.join(',');
  if (query.priorities.length > 0) params.priority = query.priorities.join(',');
  if (query.category) params.category = query.category;
  if (query.raisedByKind) params.raised_by_kind = query.raisedByKind;
  if (query.hospitalId) params.hospital_id = query.hospitalId;
  if (query.assignedToId) params.assigned_to_id = query.assignedToId;
  const ticketNo = query.ticketNo?.trim();
  if (ticketNo) params.ticket_no = ticketNo;
  if (query.dateFrom) params.date_from = query.dateFrom;
  if (query.dateTo) params.date_to = query.dateTo;
  return params;
}

/** Query string for `GET /platform/support/tickets` (`views/platform_ticket_list.py` filters). */
export interface TicketListQueryDto {
  readonly page: number;
  readonly page_size: number;
  readonly sort: string;
  readonly status?: string;
  readonly priority?: string;
  readonly category?: string;
  readonly ticket_no?: string;
}

export function toTicketListQuery(params: TicketListParams): TicketListQueryDto {
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

/** `TicketUpdateSerializer` body: only the fields that change. */
export function toTicketPatchBody(changes: TicketChanges): Record<string, string | null> {
  const assigned = changes.assignedToId !== undefined ? changes.assignedToId : changes.assigneeId;
  return {
    ...(changes.status !== undefined ? { status: changes.status } : {}),
    ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
    ...(assigned !== undefined ? { assigned_to_id: assigned } : {}),
  };
}

/** `TicketUpdateSerializer` — only the fields being changed. */
export interface TicketUpdateRequest {
  readonly status?: string;
  readonly priority?: string;
  readonly assigned_to_id?: string | null;
}

export function toTicketUpdateRequest(changes: TicketChanges): TicketUpdateRequest {
  return toTicketPatchBody(changes);
}

/** `TicketMessageSerializer` body. */
export function toTicketReplyBody(reply: TicketReply): {
  body: string;
  is_internal: boolean;
  attachment_file_ids?: string[];
} {
  const internal = reply.isInternal ?? reply.internal ?? false;
  const files = reply.attachmentFileIds ?? [];
  return {
    body: reply.body.trim(),
    is_internal: internal,
    ...(files.length > 0 ? { attachment_file_ids: [...files] } : {}),
  };
}

/** `TicketMessageSerializer`. */
export interface TicketMessageRequest {
  readonly body: string;
  readonly is_internal: boolean;
}

export function toTicketMessageRequest(reply: TicketReply): TicketMessageRequest {
  return {
    body: reply.body.trim(),
    is_internal: reply.isInternal ?? reply.internal ?? false,
  };
}
