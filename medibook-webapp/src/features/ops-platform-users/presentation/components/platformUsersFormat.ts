/** Display helpers for the patient-account screens. Pure functions, no React. */

import type {
  PlatformUserStatus,
  PlatformUserSummary,
} from '@/features/ops-platform-users/domain/entities/platformUsers.entities';
import { formatInstant } from '@/shared/lib/format';

/** Shown wherever the backend has no value for a column. */
export const NO_VALUE = '—';

/** A status pill: the `Badge` palette key plus the label it shows. */
export interface StatusPill {
  readonly badge: string;
  readonly label: string;
}

export const ACCOUNT_STATUS_PILLS: Readonly<Record<PlatformUserStatus, StatusPill>> = {
  active: { badge: 'Active', label: 'Active' },
  blocked: { badge: 'Blocked', label: 'Blocked' },
  pending_deletion: { badge: 'Pending', label: 'Pending deletion' },
  deleted: { badge: 'Inactive', label: 'Deleted' },
};

/** Backend appointment statuses (`appointments/models/appointment.py`). */
const BOOKING_STATUS_PILLS: Readonly<Record<string, StatusPill>> = {
  pending_payment: { badge: 'Pending', label: 'Pending payment' },
  pending_approval: { badge: 'Pending', label: 'Pending approval' },
  scheduled: { badge: 'Scheduled', label: 'Scheduled' },
  checked_in: { badge: 'Checked-in', label: 'Checked-in' },
  in_consultation: { badge: 'In Queue', label: 'In consultation' },
  completed: { badge: 'Completed', label: 'Completed' },
  cancelled: { badge: 'Cancelled', label: 'Cancelled' },
  no_show: { badge: 'No-show', label: 'No-show' },
};

export function bookingStatusPill(status: string): StatusPill {
  return BOOKING_STATUS_PILLS[status] ?? { badge: 'Scheduled', label: humanize(status) };
}

/** "pending_deletion" → "Pending deletion". */
export function humanize(code: string): string {
  const text = code.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function fullName(first: string, last: string | null): string {
  return [first, last].filter(Boolean).join(' ');
}

export function userName(u: PlatformUserSummary): string {
  return fullName(u.firstName, u.lastName);
}

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

function format(options: Intl.DateTimeFormatOptions, iso: string | null): string {
  if (!iso) return NO_VALUE;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? NO_VALUE : formatInstant(date, options);
}

/** "2026-01-12T05:30:00Z" → "12 Jan 2026" in India Standard Time. */
export function formatDate(iso: string | null): string {
  return format(DATE_FORMAT, iso);
}

/** "2026-01-12T05:30:00Z" → "12 Jan 2026, 11:00 am" in India Standard Time. */
export function formatDateTime(iso: string | null): string {
  return format(DATE_TIME_FORMAT, iso);
}

/** Whole years from a "yyyy-mm-dd" birth date to `now`; em dash when unknown. */
export function ageFrom(dateOfBirth: string | null, now: number): string {
  if (!dateOfBirth) return NO_VALUE;
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  if (!y || !m || !d) return NO_VALUE;
  const today = new Date(now);
  const hadBirthday =
    today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  return String(today.getFullYear() - y - (hadBirthday ? 0 : 1));
}

/** True while a failed-sign-in lockout is still running. */
export function isLockedAt(lockedUntil: string | null, now: number): boolean {
  return lockedUntil !== null && Date.parse(lockedUntil) > now;
}
