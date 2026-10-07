/**
 * Support tickets a hospital raises with the Medibook team
 * (backend `support/models/support_ticket.py`). Updates are emailed to the
 * requester (Q127); the app lists the hospital's tickets, shows each thread
 * and takes replies (UAT-30).
 */

/** What a ticket is about (backend `SupportTicket.Category`). */
export const SUPPORT_TICKET_CATEGORIES = [
  'billing',
  'technical',
  'onboarding',
  'feature_request',
  'complaint',
  'other',
] as const;

export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];

/** Backend `SupportTicket.Priority`; a new ticket defaults to `normal`. */
export type SupportTicketPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Backend `SupportTicket.Status`. */
export type SupportTicketStatus =
  'open' | 'in_progress' | 'waiting_on_requester' | 'resolved' | 'closed';

export interface SupportTicket {
  readonly id: string;
  /** Human reference from the platform `ticket` series, e.g. `TKT-2026-0001`. */
  readonly ticketNo: string;
  readonly category: SupportTicketCategory;
  readonly subject: string;
  readonly description: string;
  readonly priority: SupportTicketPriority;
  readonly status: SupportTicketStatus;
  /** ISO datetimes. */
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  /** Who raised it, when the backend names them (BE-35). */
  readonly raisedByName: string | null;
  readonly version: number;
}

/** Backend length limits on a new ticket (`TicketCreateSerializer`). */
export const TICKET_SUBJECT_MAX = 200;
export const TICKET_DESCRIPTION_MAX = 5000;

/** Who wrote a message on the thread (`SupportTicketMessage.AuthorKind`). */
export type TicketAuthorKind = 'requester' | 'platform_staff';

/** One message of a ticket's thread (internal notes never reach the hospital). */
export interface SupportTicketMessage {
  readonly id: string;
  readonly authorKind: TicketAuthorKind;
  readonly authorName: string | null;
  readonly body: string;
  /** Stored files (`ticket_attachment`), read through the shared files API. */
  readonly attachmentFileIds: readonly string[];
  readonly occurredAt: string;
}

/** A ticket with its thread, oldest message first. */
export interface SupportTicketDetail extends SupportTicket {
  readonly messages: readonly SupportTicketMessage[];
}

/** The hospital's ticket list: one status (or all), newest first, one page. */
export interface TicketListQuery {
  readonly status: SupportTicketStatus | null;
  readonly page: number;
  readonly pageSize: number;
}

export interface SupportTicketPage {
  readonly items: readonly SupportTicket[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/** Backend limits on a reply (`TicketMessageSerializer`). */
export const TICKET_MESSAGE_MAX = 5000;
export const TICKET_ATTACHMENTS_MAX = 5;

/** A reply to a ticket. */
export interface NewTicketMessage {
  readonly body: string;
  readonly attachmentFileIds: readonly string[];
}

/** What the "Raise a Ticket" form sends. */
export interface NewSupportTicket {
  readonly category: SupportTicketCategory;
  readonly subject: string;
  readonly description: string;
}

/** One help answer from the platform's hospital FAQ feed (`GET /hospital/content/faqs`, BE-34). */
export interface HelpFaq {
  readonly id: string;
  readonly category: string;
  readonly question: string;
  /** Markdown source, shown as plain text. */
  readonly answer: string;
}
