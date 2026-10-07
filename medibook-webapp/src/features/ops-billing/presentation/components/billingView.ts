import { isFailure } from '@/core/error/failure';
import { downloadFromUrl } from '@/shared/lib/download';
import { addDaysISO, daysFromTodayISO, money } from '@/shared/lib/format';

import {
  UNPAID_INVOICE_STATUSES,
  type BillingFile,
  type BillingInvoice,
  type BillingSubscription,
  type DunningKind,
  type InvoiceLine,
  type InvoiceStatus,
  type PaymentMethod,
  type PaymentStatus,
  type PlanChangeStatus,
} from '@/features/ops-billing/domain/entities/billing.entities';

/**
 * Display helpers for the ops billing screens: the API speaks paise, enum
 * codes, ISO dates and date-times; operators read rupees, labels and dates.
 */

const PAISE_PER_RUPEE = 100;
const BASIS_POINTS_PER_PERCENT = 100;

/** The backend's grace window when neither the invoice nor the hospital sets one. */
export const PLATFORM_GRACE_DAYS = 7;

/** A failed `GET …/{id}.pdf` with this status means the server cannot render PDFs. */
export const HTTP_NOT_IMPLEMENTED = 501;

/** How long a downloaded file's object URL is kept alive. */
const REVOKE_DELAY_MS = 10_000;

/** A badge: which palette entry to use (`status-map.ts`) and what it says. */
export interface BadgeSpec {
  readonly status: string;
  readonly label: string;
}

export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

export function rupees(paise: number): string {
  return money(paiseToRupees(paise));
}

/** `"2026-06-20T10:41:00+05:30"` → "20 Jun 2026, 10:41 am". */
export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** The local calendar date of an ISO date-time, for date-only columns. */
export function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

export const INVOICE_STATUS_BADGES: Readonly<Record<InvoiceStatus, BadgeSpec>> = {
  draft: { status: 'Inactive', label: 'Draft' },
  issued: { status: 'Pending', label: 'Issued' },
  paid: { status: 'Paid', label: 'Paid' },
  overdue: { status: 'Overdue', label: 'Overdue' },
  void: { status: 'Cancelled', label: 'Void' },
  uncollectible: { status: 'Failed', label: 'Uncollectible' },
};

export const PAYMENT_STATUS_BADGES: Readonly<Record<PaymentStatus, BadgeSpec>> = {
  created: { status: 'Pending', label: 'Initiated' },
  captured: { status: 'Success', label: 'Captured' },
  failed: { status: 'Payment failed', label: 'Failed' },
  refunded: { status: 'Refunded', label: 'Refunded' },
};

export const PLAN_CHANGE_BADGES: Readonly<Record<PlanChangeStatus, BadgeSpec>> = {
  requested: { status: 'Requested', label: 'Requested' },
  approved: { status: 'Completed', label: 'Approved' },
  applied: { status: 'Completed', label: 'Applied' },
  rejected: { status: 'Rejected', label: 'Rejected' },
  withdrawn: { status: 'Inactive', label: 'Withdrawn' },
};

export const METHOD_LABELS: Readonly<Record<PaymentMethod, string>> = {
  bank_transfer: 'Bank transfer',
  manual: 'Manual (cash / cheque / UPI)',
  razorpay: 'Razorpay',
  credit_note: 'Credit note',
};

export const DUNNING_LABELS: Readonly<Record<DunningKind, string>> = {
  reminder_queued: 'Queued',
  reminder_sent: 'Sent',
  grace_started: 'Grace started',
  grace_extended: 'Grace changed',
  suspended: 'Suspended',
  read_only: 'Read-only',
  reinstated: 'Reinstated',
  marked_paid: 'Marked paid',
  retry_scheduled: 'Retry scheduled',
  retry_attempted: 'Retry attempted',
  voided: 'Voided',
};

/** Pick the enum value whose label matches, or `null` for "All". */
export function fromLabel<K extends string>(
  labels: Readonly<Record<K, string | BadgeSpec>>,
  label: string,
): K | null {
  const keys = Object.keys(labels) as K[];
  return (
    keys.find((k) => {
      const v = labels[k];
      return (typeof v === 'string' ? v : v.label) === label;
    }) ?? null
  );
}

export function isUnpaid(inv: Pick<BillingInvoice, 'status'>): boolean {
  return UNPAID_INVOICE_STATUSES.includes(inv.status);
}

export function outstandingPaise(inv: Pick<BillingInvoice, 'totalPaise' | 'amountPaidPaise'>) {
  return Math.max(0, inv.totalPaise - inv.amountPaidPaise);
}

/** The backend voids draft/issued/overdue invoices with nothing paid against them. */
export function canVoid(inv: Pick<BillingInvoice, 'status' | 'amountPaidPaise'>): boolean {
  return (inv.status === 'draft' || isUnpaid(inv)) && inv.amountPaidPaise === 0;
}

/** "GST (18%)" from the lines' rates; "GST" when the lines disagree or carry none. */
export function gstLabel(lines: readonly InvoiceLine[]): string {
  const rates = new Set(lines.filter((l) => l.taxRateBp > 0).map((l) => l.taxRateBp));
  if (rates.size !== 1) return 'GST';
  const [bp] = [...rates];
  return `GST (${(bp ?? 0) / BASIS_POINTS_PER_PERCENT}%)`;
}

export interface GraceView {
  /** ISO date the window closes. */
  readonly endsIso: string;
  /** Who decided the length: a date set on the invoice, the hospital override, or the default. */
  readonly source: 'invoice' | 'hospital' | 'platform';
  /** Whole days from today to the end — negative once it has closed. */
  readonly daysLeft: number;
  /** Past the due date, still inside the window. */
  readonly inGrace: boolean;
  /** Window closed with the invoice still unpaid — suspension is on the table. */
  readonly expired: boolean;
}

/**
 * When an unpaid invoice's grace window closes. Once the backend has set
 * `grace_ends_at` that date stands; before then it is the due date plus the
 * hospital's override, or the platform default.
 */
export function graceFor(
  inv: BillingInvoice,
  subscription: BillingSubscription | null | undefined,
): GraceView | null {
  if (!isUnpaid(inv)) return null;
  const override = subscription?.graceDaysOverride ?? null;
  const endsIso = inv.graceEndsAt ?? addDaysISO(inv.dueAt, override ?? PLATFORM_GRACE_DAYS);
  const source = inv.graceEndsAt ? 'invoice' : override !== null ? 'hospital' : 'platform';
  const daysLeft = daysFromTodayISO(endsIso);
  return {
    endsIso,
    source,
    daysLeft,
    inGrace: daysFromTodayISO(inv.dueAt) < 0 && daysLeft >= 0,
    expired: daysLeft < 0,
  };
}

export function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

/** A user-safe sentence for a failed action. */
export function failureText(error: unknown, fallback: string): string {
  if (!isFailure(error)) return fallback;
  const first = Object.values(error.fieldErrors)[0]?.[0];
  return first ?? error.message;
}

export function isNotImplemented(error: unknown): boolean {
  return isFailure(error) && error.status === HTTP_NOT_IMPLEMENTED;
}

/** Hand a backend-generated file to the browser's download. */
export function saveFile(file: BillingFile): void {
  const url = URL.createObjectURL(file.blob);
  downloadFromUrl(url, file.filename);
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
