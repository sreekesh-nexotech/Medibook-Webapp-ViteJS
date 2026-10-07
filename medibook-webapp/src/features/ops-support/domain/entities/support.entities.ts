/**
 * Support tickets as the Medibook team works them (`/platform/support/tickets`,
 * backend `support/services/tickets.py`). Requesters are hospital staff or
 * patients; they hear back by email (Q127). Internal notes stay inside the
 * platform team and never reach the requester.
 */

export const TICKET_STATUSES = [
  'open',
  'in_progress',
  'waiting_on_requester',
  'resolved',
  'closed',
] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;

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

export const TICKET_RAISERS = ['hospital_staff', 'patient'] as const;

export type TicketRaisedByKind = (typeof TICKET_RAISERS)[number];

export type TicketAuthorKind = 'requester' | 'platform_staff';

/** Backend limits (`TicketMessageSerializer`). */
export const TICKET_MESSAGE_MAX = 5000;
export const TICKET_ATTACHMENTS_MAX = 5;

export interface SupportTicket {
  readonly id: string;
  /** Human reference, e.g. `TKT-2026-0001` — what staff and requesters quote. */
  readonly ticketNo: string;
  readonly raisedByKind: TicketRaisedByKind;
  /** The requester's name (B9); `null` on an older server or a deleted account. */
  readonly raisedByName: string | null;
  readonly hospitalId: string | null;
  /** B9; `null` for patient tickets and on an older server. */
  readonly hospitalName: string | null;
  readonly category: TicketCategory;
  readonly subject: string;
  readonly description: string;
  readonly priority: TicketPriority;
  readonly status: TicketStatus;
  /** A platform staff row id (not a user id). */
  readonly assignedToId: string | null;
  /** B9; `null` when unassigned or on an older server. */
  readonly assignedToName: string | null;
  /** Statuses the server accepts next (B9, L-25); `null` when it does not say. */
  readonly allowedTransitions: readonly TicketStatus[] | null;
  readonly resolvedAt: string | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** `If-Match` token for a change. */
  readonly version: number;
}

export interface TicketMessage {
  readonly id: string;
  readonly authorKind: TicketAuthorKind;
  readonly authorName: string | null;
  readonly body: string;
  readonly attachmentFileIds: readonly string[];
  /** Platform-only note; never shown to the requester. */
  readonly isInternal: boolean;
  readonly occurredAt: string;
}

export interface SupportTicketDetail extends SupportTicket {
  /** Oldest first. */
  readonly messages: readonly TicketMessage[];
}

export type TicketSortKey = 'created_at' | 'updated_at';

export interface TicketListQuery {
  readonly page: number;
  readonly pageSize: number;
  /** Empty = every status. */
  readonly statuses: readonly TicketStatus[];
  /** Empty = every priority. */
  readonly priorities: readonly TicketPriority[];
  readonly category: TicketCategory | null;
  readonly raisedByKind: TicketRaisedByKind | null;
  readonly hospitalId: string | null;
  readonly assignedToId: string | null;
  /** Exact ticket number. */
  readonly ticketNo: string | null;
  /** `YYYY-MM-DD`, on the day the ticket was raised. */
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly sort: TicketSortKey;
  readonly sortDir: 'asc' | 'desc';
}

/** What a platform agent may change on a ticket (`support.edit`). */
export interface TicketChanges {
  readonly status?: TicketStatus;
  readonly priority?: TicketPriority;
  /** `null` unassigns. */
  readonly assignedToId?: string | null;
}

export interface TicketReply {
  readonly body: string;
  /** Clean `ticket_attachment` files this agent uploaded. */
  readonly attachmentFileIds: readonly string[];
  /** An internal note: kept from the requester and sends no email. */
  readonly isInternal: boolean;
}
