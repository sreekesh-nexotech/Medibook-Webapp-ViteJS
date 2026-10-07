import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  SupportTicket,
  SupportTicketDetail,
  TicketMessage,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  MESSAGE_AUTHOR_KINDS,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_REQUESTER_KINDS,
  TICKET_STATUSES,
} from '@/features/ops-support/domain/entities/support.entities';

/** `tickets.serialize()` as platform staff see it (backend `support/services/tickets.py`). */
export const ticketResponseSchema = z.object({
  id: z.string(),
  ticket_no: z.string(),
  raised_by_kind: z.enum(TICKET_REQUESTER_KINDS),
  hospital_id: z.string().nullable(),
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string(),
  description: z.string(),
  priority: z.enum(TICKET_PRIORITIES),
  status: z.enum(TICKET_STATUSES),
  resolved_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int(),
  raised_by_id: z.string().nullable(),
  assigned_to_id: z.string().nullable(),
});

/** `tickets.serialize_message()` — `is_internal` is sent to platform staff only. */
export const ticketMessageResponseSchema = z.object({
  id: z.string(),
  author_kind: z.enum(MESSAGE_AUTHOR_KINDS),
  author_name: z.string().nullable(),
  body: z.string(),
  attachment_file_ids: z.array(z.string()),
  occurred_at: z.string(),
  is_internal: z.boolean().optional(),
});

export const ticketPageResponseSchema = paginatedSchema(ticketResponseSchema);

export const ticketDetailResponseSchema = ticketResponseSchema.extend({
  messages: z.array(ticketMessageResponseSchema),
});

export type TicketResponse = z.infer<typeof ticketResponseSchema>;
export type TicketMessageResponse = z.infer<typeof ticketMessageResponseSchema>;
export type TicketPageResponse = z.infer<typeof ticketPageResponseSchema>;
export type TicketDetailResponse = z.infer<typeof ticketDetailResponseSchema>;

export function toSupportTicket(dto: TicketResponse): SupportTicket {
  return {
    id: dto.id,
    ticketNo: dto.ticket_no,
    requesterKind: dto.raised_by_kind,
    hospitalId: dto.hospital_id,
    requesterId: dto.raised_by_id,
    category: dto.category,
    subject: dto.subject,
    description: dto.description,
    priority: dto.priority,
    status: dto.status,
    assigneeId: dto.assigned_to_id,
    resolvedAt: dto.resolved_at,
    closedAt: dto.closed_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    version: dto.version,
  };
}

export function toTicketMessage(dto: TicketMessageResponse): TicketMessage {
  return {
    id: dto.id,
    authorKind: dto.author_kind,
    authorName: dto.author_name,
    body: dto.body,
    attachmentIds: dto.attachment_file_ids,
    occurredAt: dto.occurred_at,
    isInternal: dto.is_internal ?? false,
  };
}

export function toSupportTicketDetail(dto: TicketDetailResponse): SupportTicketDetail {
  return { ...toSupportTicket(dto), messages: dto.messages.map(toTicketMessage) };
}
