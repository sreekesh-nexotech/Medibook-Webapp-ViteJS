/**
 * Pure subscription-billing rules (audit SA-03) — tax split, grace windows and
 * the identifier series. No React, no stores, so the screens, the store and
 * the printable invoice all compute the same numbers.
 */
import type { OpsHospital } from '@/features/ops-hospitals/application/store/hospitals.types';
import {
  addDaysIso,
  daysBetweenIso,
  isoFromLongDate,
} from '@/features/ops-hospitals/application/store/opsDates';

import type { Invoice, Payment } from '@/features/ops-billing/application/store/billing.types';

/** GST charged on a Medibook subscription, as a separate invoice line. */
export const GST_RATE = 0.18;

/** Medibook's own GSTIN, printed on every invoice. */
export const MEDIBOOK_GSTIN = '27AABCM9407L1ZK';

/** Days a hospital gets past the due date before ops may suspend it. */
export const PLATFORM_GRACE_DAYS = 7;

/** Invoice series: `INV-<year>-<4-digit sequence>`. */
const INVOICE_PREFIX = 'INV';

/** Gateway transaction series the prototype used: `TXN-<5 digits>`. */
const TXN_PREFIX = 'TXN';

/** The 18% GST split out of a gross amount, as the invoice prints it. */
export interface InvoiceTax {
  /** Taxable value (the plan price). */
  readonly base: number;
  readonly cgst: number;
  readonly sgst: number;
  /** CGST + SGST — the whole 18%. */
  readonly gst: number;
  readonly total: number;
}

/** Split a gross invoice amount into its taxable base and the two GST halves. */
export function invoiceTax(amount: number): InvoiceTax {
  const base = Math.round(amount / (1 + GST_RATE));
  const gst = amount - base;
  const cgst = Math.round(gst / 2);
  return { base, cgst, sgst: gst - cgst, gst, total: amount };
}

/** True while the invoice still owes money. */
export function isUnpaid(inv: Invoice): boolean {
  return inv.status !== 'Completed';
}

/** The grace window that applies: invoice override, else hospital, else platform. */
export function graceDaysFor(inv: Invoice, hospital: OpsHospital | null | undefined): number {
  if (inv.graceDays !== undefined) return inv.graceDays;
  if (hospital?.graceDays !== undefined) return hospital.graceDays;
  return PLATFORM_GRACE_DAYS;
}

/** Where the grace window sits relative to today. */
export interface GraceInfo {
  readonly days: number;
  /** Where the override came from, so the screen can say so. */
  readonly source: 'invoice' | 'hospital' | 'platform';
  /** Local-calendar ISO date the window closes. */
  readonly endsIso: string;
  /** Days left — negative once the window has closed. */
  readonly daysLeft: number;
  /** Still inside the window (due date passed, grace not yet exhausted). */
  readonly inGrace: boolean;
  /** Window closed with the invoice still unpaid — suspension is on the table. */
  readonly expired: boolean;
}

/**
 * The invoice's grace window. `null` when the invoice is paid or its due date
 * cannot be read — there is nothing to count down in either case.
 */
export function graceFor(
  inv: Invoice,
  hospital: OpsHospital | null | undefined,
  todayIso: string,
): GraceInfo | null {
  if (!isUnpaid(inv)) return null;
  const dueIso = isoFromLongDate(inv.due);
  if (!dueIso) return null;
  const days = graceDaysFor(inv, hospital);
  const source =
    inv.graceDays !== undefined
      ? 'invoice'
      : hospital?.graceDays !== undefined
        ? 'hospital'
        : 'platform';
  const endsIso = addDaysIso(dueIso, days);
  const daysLeft = daysBetweenIso(todayIso, endsIso);
  const overdue = daysBetweenIso(dueIso, todayIso) > 0;
  return {
    days,
    source,
    endsIso,
    daysLeft,
    inGrace: overdue && daysLeft >= 0,
    expired: daysLeft < 0,
  };
}

/** Next number in the canonical invoice series, e.g. `INV-2026-0243`. */
export function nextInvoiceNo(invoices: readonly Invoice[], year: number): string {
  const prefix = `${INVOICE_PREFIX}-${year}-`;
  const highest = invoices.reduce((max, inv) => {
    if (!inv.no.startsWith(prefix)) return max;
    const seq = Number(inv.no.slice(prefix.length));
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(4, '0')}`;
}

/** Next gateway transaction reference, continuing the seeded `TXN-` series. */
export function nextTxnNo(payments: readonly Payment[]): string {
  const highest = payments.reduce((max, p) => {
    const seq = Number(p.txn.replace(`${TXN_PREFIX}-`, ''));
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${TXN_PREFIX}-${highest + 1}`;
}
