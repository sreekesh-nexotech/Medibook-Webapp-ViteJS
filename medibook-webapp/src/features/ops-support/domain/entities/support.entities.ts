/**
 * Support tickets raised by hospitals (Help & Support) and patients (the
 * Medibook app), as the ops console answers them (`/api/v1/platform/support/
 * tickets`, backend `support/services/tickets.py`). Every change and every
 * reply that is not an internal note is emailed to the requester (Q127).
 */

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'waiting_on_requester',
  'resolved',
  'closed',
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Tickets that still need someone at Medibook. */
export const UNRESOLVED_STATUSES: readonly TicketStatus[] = [
  'open',
  'in_progress',
  'waiting_on_requester',
];

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  'billing',
  'technical',
  'onboarding',
  'feature_request',
  'complaint',
  'other',
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_REQUESTER_KINDS = ['hospital_staff', 'patient'] as const;
export type TicketRequesterKind = (typeof TICKET_REQUESTER_KINDS)[number];

export const MESSAGE_AUTHOR_KINDS = ['requester', 'platform_staff'] as const;
export type MessageAuthorKind = (typeof MESSAGE_AUTHOR_KINDS)[number];

export interface SupportTicket {
  readonly id: string;
  /** `TKT-2026-0042`. */
  readonly ticketNo: string;
  readonly requesterKind: TicketRequesterKind;
  /** The hospital that raised it; `null` for a patient's ticket. */
  readonly hospitalId: string | null;
  /** The hospital user or patient account that raised it. */
  readonly requesterId: string | null;
  readonly category: TicketCategory;
  readonly subject: string;
  readonly description: string;
  readonly priority: TicketPriority;
  readonly status: TicketStatus;
  /** Platform staff member it is assigned to. */
  readonly assigneeId: string | null;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** Row version, sent as `If-Match` on changes. */
  readonly version: number;
}

export interface TicketMessage {
  readonly id: string;
  readonly authorKind: MessageAuthorKind;
  readonly authorName: string | null;
  readonly body: string;
  readonly attachmentIds: readonly string[];
  readonly occurredAt: string;
  /** A note for Medibook staff only; never shown or emailed to the requester. */
  readonly isInternal: boolean;
}

export interface SupportTicketDetail extends SupportTicket {
  /** The thread, oldest first. */
  readonly messages: readonly TicketMessage[];
}

export interface TicketListParams {
  /** Empty = every status. */
  readonly statuses: readonly TicketStatus[];
  readonly priority: TicketPriority | null;
  readonly category: TicketCategory | null;
  /** Exact ticket number, e.g. `TKT-2026-0042`; empty = any. */
  readonly ticketNo: string;
  /** Server sort, e.g. `-updated_at`. */
  readonly sort: string;
  readonly page: number;
  readonly pageSize: number;
}

/** What ops can change on a ticket. */
export interface TicketChanges {
  readonly status?: TicketStatus;
  readonly priority?: TicketPriority;
  /** `null` unassigns. */
  readonly assigneeId?: string | null;
}

export interface TicketReply {
  readonly body: string;
  /** Internal note: visible to Medibook staff only. */
  readonly internal: boolean;
}
