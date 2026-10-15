import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  HelpFaq,
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
  raised_by_name: z.string().nullable().optional(),
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
    raisedByName: dto.raised_by_name ?? null,
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

/** `GET /hospital/content/faqs` — published entries grouped by category (BE-34). */
export const faqFeedSchema = z.object({
  categories: z.array(
    z.object({
      category: z.string(),
      entries: z.array(
        z.object({
          id: z.string(),
          question: z.string(),
          answer_md: z.string(),
          sort_order: z.number().int(),
        }),
      ),
    }),
  ),
});

export function toHelpFaqs(dto: z.infer<typeof faqFeedSchema>): HelpFaq[] {
  return dto.categories.flatMap((group) =>
    [...group.entries]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((e) => ({
        id: e.id,
        category: group.category,
        question: e.question,
        answer: e.answer_md,
      })),
  );
}
