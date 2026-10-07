import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  SupportTicket,
  SupportTicketDetail,
  SupportTicketMessage,
} from '@/features/help/domain/entities/help.types';
import { SUPPORT_TICKET_CATEGORIES } from '@/features/help/domain/entities/help.types';

/**
 * A ticket as the hospital surface sees it (backend
 * `support/services/tickets.py::serialize`); `schema.yml` types it only as
 * `object`. Platform-only fields (`raised_by_id`, `assigned_to_id`) are absent.
 */
export const supportTicketResponseSchema = z.object({
  id: z.string(),
  ticket_no: z.string(),
  raised_by_kind: z.enum(['hospital_staff', 'patient']),
  hospital_id: z.string().nullable(),
  category: z.enum(SUPPORT_TICKET_CATEGORIES),
  subject: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  status: z.enum(['open', 'in_progress', 'waiting_on_requester', 'resolved', 'closed']),
  resolved_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int(),
});

export type SupportTicketResponse = z.infer<typeof supportTicketResponseSchema>;

export function toSupportTicket(dto: SupportTicketResponse): SupportTicket {
  return {
    id: dto.id,
    ticketNo: dto.ticket_no,
    category: dto.category,
    subject: dto.subject,
    description: dto.description,
    priority: dto.priority,
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    resolvedAt: dto.resolved_at,
    closedAt: dto.closed_at,
    version: dto.version,
  };
}

/** `support/services/tickets.py::serialize_message` as the hospital sees it. */
export const ticketMessageResponseSchema = z.object({
  id: z.string(),
  author_kind: z.enum(['requester', 'platform_staff']),
  author_name: z.string().nullable(),
  body: z.string(),
  attachment_file_ids: z.array(z.string()),
  occurred_at: z.string(),
});

export const supportTicketPageSchema = paginatedSchema(supportTicketResponseSchema);

/** `GET …/support/tickets/{id}` — the ticket with its `messages`. */
export const supportTicketDetailSchema = supportTicketResponseSchema.extend({
  messages: z.array(ticketMessageResponseSchema),
});

export type TicketMessageResponse = z.infer<typeof ticketMessageResponseSchema>;

export function toTicketMessage(dto: TicketMessageResponse): SupportTicketMessage {
  return {
    id: dto.id,
    authorKind: dto.author_kind,
    authorName: dto.author_name,
    body: dto.body,
    attachmentFileIds: dto.attachment_file_ids,
    occurredAt: dto.occurred_at,
  };
}

export function toSupportTicketDetail(
  dto: z.infer<typeof supportTicketDetailSchema>,
): SupportTicketDetail {
  return { ...toSupportTicket(dto), messages: dto.messages.map(toTicketMessage) };
}
