/** Display helpers for the support inbox. Pure functions, no React. */

import type {
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@/features/ops-support/domain/entities/support.entities';
import { formatInstant } from '@/shared/lib/format';

/** Shown wherever there is no value. */
export const NO_VALUE = '—';

/** A pill: the `Badge` palette key plus the label it shows. */
export interface Pill {
  readonly badge: string;
  readonly label: string;
}

export const STATUS_PILLS: Readonly<Record<TicketStatus, Pill>> = {
  open: { badge: 'Open', label: 'Open' },
  in_progress: { badge: 'Scheduled', label: 'In progress' },
  waiting_on_requester: { badge: 'Pending', label: 'Waiting on requester' },
  resolved: { badge: 'Resolved', label: 'Resolved' },
  closed: { badge: 'Inactive', label: 'Closed' },
};

export const PRIORITY_PILLS: Readonly<Record<TicketPriority, Pill>> = {
  urgent: { badge: 'Critical', label: 'Urgent' },
  high: { badge: 'Warning', label: 'High' },
  normal: { badge: 'Info', label: 'Normal' },
  low: { badge: 'Inactive', label: 'Low' },
};

export const CATEGORY_LABELS: Readonly<Record<TicketCategory, string>> = {
  billing: 'Billing',
  technical: 'Technical',
  onboarding: 'Onboarding',
  feature_request: 'Feature request',
  complaint: 'Complaint',
  other: 'Other',
};

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

/** "2026-10-06T08:10:22Z" → "6 Oct 2026, 1:40 pm" on the ops calendar (India Standard Time). */
export function formatDateTime(iso: string | null): string {
  if (!iso) return NO_VALUE;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? NO_VALUE : formatInstant(date, DATE_TIME_FORMAT);
}

/** Who raised it, in a word: the hospital is resolved separately (`TicketRequester`). */
export function requesterKindLabel(ticket: SupportTicket): string {
  return ticket.requesterKind === 'patient' ? 'Patient · Medibook app' : 'Hospital staff';
}
