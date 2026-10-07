/**
 * Support desk view rules: labels and badge looks, which status moves a
 * ticket may make, and how a ticket's thread reads. Pure functions.
 */
import type { FileStatus } from '@/core/api/files.types';

import type {
  SupportTicket,
  SupportTicketDetail,
  TicketCategory,
  TicketPriority,
  TicketRaisedByKind,
  TicketStatus,
} from '@/features/ops-support/domain/entities/support.entities';
import { TICKET_MESSAGE_MAX } from '@/features/ops-support/domain/entities/support.entities';

interface Look {
  readonly label: string;
  /** A `Badge` status key from the shared palette. */
  readonly badge: string;
}

export const STATUS_LOOK: Readonly<Record<TicketStatus, Look>> = {
  open: { label: 'Open', badge: 'Open' },
  in_progress: { label: 'In progress', badge: 'Scheduled' },
  waiting_on_requester: { label: 'Waiting on requester', badge: 'On Hold' },
  resolved: { label: 'Resolved', badge: 'Resolved' },
  closed: { label: 'Closed', badge: 'Inactive' },
};

export const PRIORITY_LOOK: Readonly<Record<TicketPriority, Look>> = {
  urgent: { label: 'Urgent', badge: 'Critical' },
  high: { label: 'High', badge: 'Warning' },
  normal: { label: 'Normal', badge: 'Info' },
  low: { label: 'Low', badge: 'Inactive' },
};

export const CATEGORY_LABEL: Readonly<Record<TicketCategory, string>> = {
  billing: 'Billing',
  technical: 'Technical',
  onboarding: 'Onboarding',
  feature_request: 'Feature request',
  complaint: 'Complaint',
  other: 'Other',
};

export const RAISER_LABEL: Readonly<Record<TicketRaisedByKind, string>> = {
  hospital_staff: 'Hospital staff',
  patient: 'Patient',
};

/** The desk's default view: everything still needing someone. */
export const ACTIVE_STATUSES: readonly TicketStatus[] = [
  'open',
  'in_progress',
  'waiting_on_requester',
];

/**
 * B9's status moves (L-25), used when the server does not send
 * `allowed_transitions`: `closed` is terminal and `resolved` only re-opens
 * into work or closes.
 */
export const SUPPORT_TRANSITIONS: Readonly<Record<TicketStatus, readonly TicketStatus[]>> = {
  open: ['in_progress', 'waiting_on_requester', 'resolved', 'closed'],
  in_progress: ['open', 'waiting_on_requester', 'resolved', 'closed'],
  waiting_on_requester: ['in_progress', 'resolved', 'closed'],
  resolved: ['in_progress', 'closed'],
  closed: [],
};

/** Statuses this ticket may move to next, in the desk's display order. */
export function nextStatuses(ticket: SupportTicket): readonly TicketStatus[] {
  const allowed = new Set(ticket.allowedTransitions ?? SUPPORT_TRANSITIONS[ticket.status]);
  allowed.delete(ticket.status);
  return (Object.keys(STATUS_LOOK) as TicketStatus[]).filter((s) => allowed.has(s));
}

/** Replies are refused on a closed ticket (`409 STATE_CONFLICT`). */
export function acceptsReplies(ticket: SupportTicket): boolean {
  return ticket.status !== 'closed';
}

/** "Anita Menon · Hospital staff · Lakeshore Hospital", with what the server sent. */
export function requesterLine(ticket: SupportTicket): string {
  const parts = [ticket.raisedByName ?? 'Name unavailable', RAISER_LABEL[ticket.raisedByKind]];
  if (ticket.raisedByKind === 'hospital_staff') {
    parts.push(ticket.hospitalName ?? 'Hospital name unavailable');
  }
  return parts.join(' · ');
}

/** The assignee as the desk names them; `staffName` resolves an id when the server sends none. */
export function assigneeLabel(
  ticket: SupportTicket,
  staffName: (staffId: string) => string | null,
): string {
  if (ticket.assignedToId === null) return 'Unassigned';
  return ticket.assignedToName ?? staffName(ticket.assignedToId) ?? 'Assigned';
}

export type ThreadVoice = 'requester' | 'staff' | 'internal';

export interface ThreadEntry {
  readonly key: string;
  readonly voice: ThreadVoice;
  readonly author: string;
  readonly body: string;
  readonly attachmentFileIds: readonly string[];
  readonly at: string;
}

/**
 * The thread as it reads: the ticket's own description first, then each
 * message. A ticket raised with attachments also stores the description as
 * its first message (to carry the files); that copy is folded into the
 * opening entry instead of showing the same text twice.
 */
export function threadEntries(ticket: SupportTicketDetail): readonly ThreadEntry[] {
  const requester = ticket.raisedByName ?? RAISER_LABEL[ticket.raisedByKind];
  const [first, ...rest] = ticket.messages;
  const folded =
    first !== undefined &&
    first.authorKind === 'requester' &&
    !first.isInternal &&
    first.body === ticket.description &&
    first.attachmentFileIds.length > 0;
  const opening: ThreadEntry = {
    key: `ticket-${ticket.id}`,
    voice: 'requester',
    author: requester,
    body: ticket.description,
    attachmentFileIds: folded ? first.attachmentFileIds : [],
    at: ticket.createdAt,
  };
  const messages = folded ? rest : ticket.messages;
  return [
    opening,
    ...messages.map((m): ThreadEntry => ({
      key: m.id,
      voice: m.isInternal ? 'internal' : m.authorKind === 'requester' ? 'requester' : 'staff',
      author: m.authorName ?? (m.authorKind === 'requester' ? requester : 'Medibook support'),
      body: m.body,
      attachmentFileIds: m.attachmentFileIds,
      at: m.occurredAt,
    })),
  ];
}

export type AttachmentsState = 'ready' | 'scanning' | 'failed';

const SCAN_FAILED: ReadonlySet<FileStatus> = new Set(['infected', 'scan_failed', 'failed']);

/** Whether the files waiting to go on a reply are all clean, still scanning, or refused. */
export function attachmentsState(statuses: readonly (FileStatus | undefined)[]): AttachmentsState {
  if (statuses.some((s) => s !== undefined && SCAN_FAILED.has(s))) return 'failed';
  return statuses.every((s) => s === 'clean') ? 'ready' : 'scanning';
}

/** What a waiting attachment shows next to its name. */
export function attachmentStatusLabel(status: FileStatus | undefined): string {
  if (status === 'clean') return 'Ready';
  if (status === 'infected') return 'Virus found — remove it';
  if (status !== undefined && SCAN_FAILED.has(status)) return 'Scan failed — remove it';
  return 'Scanning…';
}

/** Why a reply cannot be sent yet, or `null` when it can. */
export function replyProblem(body: string, attachments: AttachmentsState): string | null {
  const text = body.trim();
  if (text === '') return 'Write a message first.';
  if (text.length > TICKET_MESSAGE_MAX) {
    return `Keep the message under ${TICKET_MESSAGE_MAX.toLocaleString('en-IN')} characters.`;
  }
  if (attachments === 'failed') return 'Remove the files that did not pass the virus scan.';
  if (attachments === 'scanning') return 'Wait for the attachments to finish their virus scan.';
  return null;
}

/** `TKT-2026-0001` typed as `tkt-2026-0001 ` still matches (the filter is exact). */
export function normaliseTicketNo(text: string): string {
  return text.trim().toUpperCase();
}
