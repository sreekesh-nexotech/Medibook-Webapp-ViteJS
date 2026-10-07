import type {
  TicketChanges,
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

/** `TicketUpdateSerializer` body: only the fields that change. */
export function toTicketPatchBody(changes: TicketChanges): Record<string, string | null> {
  return {
    ...(changes.status !== undefined ? { status: changes.status } : {}),
    ...(changes.priority !== undefined ? { priority: changes.priority } : {}),
    ...(changes.assignedToId !== undefined ? { assigned_to_id: changes.assignedToId } : {}),
  };
}

/** `TicketMessageSerializer` body. */
export function toTicketReplyBody(reply: TicketReply): {
  body: string;
  is_internal: boolean;
  attachment_file_ids?: string[];
} {
  return {
    body: reply.body.trim(),
    is_internal: reply.isInternal,
    ...(reply.attachmentFileIds.length > 0
      ? { attachment_file_ids: [...reply.attachmentFileIds] }
      : {}),
  };
}
