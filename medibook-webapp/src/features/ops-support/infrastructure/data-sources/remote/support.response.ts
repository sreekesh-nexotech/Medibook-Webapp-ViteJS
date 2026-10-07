import { z } from 'zod';

import { paginatedSchema } from '@/core/api/pagination';

import type {
  SupportTicket,
  SupportTicketDetail,
  TicketMessage,
} from '@/features/ops-support/domain/entities/support.entities';
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_RAISERS,
  TICKET_STATUSES,
} from '@/features/ops-support/domain/entities/support.entities';

const statusSchema = z.enum(TICKET_STATUSES);

/**
 * A ticket as the platform sees it (`tickets.serialize`, B9 `TicketOutSerializer`).
 * The names and `allowed_transitions` are B9 additions (L-25) — optional so
 * an older server still parses.
 */
export const ticketResponseSchema = z.object({
  id: z.string(),
  ticket_no: z.string(),
  raised_by_kind: z.enum(TICKET_RAISERS),
  raised_by_name: z.string().nullable().optional(),
  raised_by_id: z.string().nullable().optional(),
  hospital_id: z.string().nullable(),
  hospital_name: z.string().nullable().optional(),
  category: z.enum(TICKET_CATEGORIES),
  subject: z.string(),
  description: z.string(),
  priority: z.enum(TICKET_PRIORITIES),
  status: statusSchema,
  assigned_to_id: z.string().nullable().optional(),
  assigned_to_name: z.string().nullable().optional(),
  allowed_transitions: z.array(statusSchema).optional(),
  resolved_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  version: z.number().int(),
});

/** `tickets.serialize_message`; `is_internal` is sent to platform staff only. */
export const ticketMessageResponseSchema = z.object({
  id: z.string(),
  author_kind: z.enum(['requester', 'platform_staff']),
  author_name: z.string().nullable(),
  body: z.string(),
  attachment_file_ids: z.array(z.string()),
  occurred_at: z.string(),
  is_internal: z.boolean().optional(),
});

export const ticketDetailResponseSchema = ticketResponseSchema.extend({
  messages: z.array(ticketMessageResponseSchema),
});

export const ticketPageResponseSchema = paginatedSchema(ticketResponseSchema);

export type TicketResponse = z.infer<typeof ticketResponseSchema>;
export type TicketMessageResponse = z.infer<typeof ticketMessageResponseSchema>;
export type TicketDetailResponse = z.infer<typeof ticketDetailResponseSchema>;
export type TicketPageResponse = z.infer<typeof ticketPageResponseSchema>;

export function toSupportTicket(dto: TicketResponse): SupportTicket {
  return {
    id: dto.id,
    ticketNo: dto.ticket_no,
    raisedByKind: dto.raised_by_kind,
    raisedByName: dto.raised_by_name ?? null,
    hospitalId: dto.hospital_id,
    hospitalName: dto.hospital_name ?? null,
    category: dto.category,
    subject: dto.subject,
    description: dto.description,
    priority: dto.priority,
    status: dto.status,
    assignedToId: dto.assigned_to_id ?? null,
    assignedToName: dto.assigned_to_name ?? null,
    allowedTransitions: dto.allowed_transitions ?? null,
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
    attachmentFileIds: dto.attachment_file_ids,
    isInternal: dto.is_internal ?? false,
    occurredAt: dto.occurred_at,
  };
}

export function toSupportTicketDetail(dto: TicketDetailResponse): SupportTicketDetail {
  return { ...toSupportTicket(dto), messages: dto.messages.map(toTicketMessage) };
}
