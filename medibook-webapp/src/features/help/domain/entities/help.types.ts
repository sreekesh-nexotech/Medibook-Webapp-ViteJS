/**
 * Support tickets a hospital raises with the Medibook team
 * (backend `support/models/support_ticket.py`). Updates reach the requester by
 * email only (backend Q127) — the app raises a ticket and shows its number.
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
  readonly version: number;
}

/** Backend length limits on a new ticket (`TicketCreateSerializer`). */
export const TICKET_SUBJECT_MAX = 200;
export const TICKET_DESCRIPTION_MAX = 5000;

/** What the "Raise a Ticket" form sends. */
export interface NewSupportTicket {
  readonly category: SupportTicketCategory;
  readonly subject: string;
  readonly description: string;
}
