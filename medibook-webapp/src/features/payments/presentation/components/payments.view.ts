/**
 * Presentation lookups and pure helpers for the Payments screen (H9): the
 * look-back date windows, method / status vocabulary, refund availability and
 * the day's totals.
 */
import { isFailure } from '@/core/error/failure';
import { fmtDate, parseHundredths, toLocalISO } from '@/shared/lib/format';
import { addIsoDays } from '@/shared/lib/hospitalTime';

import type {
  BookingStatus,
  CashSummaryRow,
  LineRefund,
  PaymentLine,
  PaymentLineStatus,
  PaymentMethod,
  PaymentRefund,
  RefundStatus,
} from '@/features/payments/domain/entities/payments.entities';

/** Payments look back: a preset window ends today; a custom one is any range. */
export type PaymentWindow = 'Today' | 'This Week' | 'This Month' | 'Custom range';

export const PAYMENT_WINDOWS: readonly PaymentWindow[] = [
  'Today',
  'This Week',
  'This Month',
  'Custom range',
];

const WEEK_DAYS = 7;
const FIRST_OF_MONTH = '01';

export interface DateRange {
  readonly dateFrom: string;
  readonly dateTo: string;
}

/**
 * The dates a window covers, ending on `today` — the hospital's calendar day
 * (`useHospitalToday`, D-09, UAT-47), never the PC's. `Custom range` uses
 * `custom`, defaulting to today.
 */
export function rangeForWindow(
  window: PaymentWindow,
  today: string,
  custom?: Partial<DateRange>,
): DateRange {
  if (window === 'Custom range') {
    return { dateFrom: custom?.dateFrom || today, dateTo: custom?.dateTo || today };
  }
  if (window === 'This Week')
    return { dateFrom: addIsoDays(today, -(WEEK_DAYS - 1)), dateTo: today };
  if (window === 'This Month')
    return { dateFrom: `${today.slice(0, 8)}${FIRST_OF_MONTH}`, dateTo: today };
  return { dateFrom: today, dateTo: today };
}

/**
 * The mode filter's options and the method each one asks the server for:
 * every method the backend records, so POS and Other desk payments (and the
 * gateway's net banking / wallet / EMI) can be found too.
 */
export const MODE_FILTER: Readonly<Record<string, PaymentMethod>> = {
  Cash: 'cash',
  UPI: 'upi',
  Card: 'card',
  POS: 'pos',
  Other: 'other',
  'Net banking': 'netbanking',
  Wallet: 'wallet',
  EMI: 'emi',
  'Pay later': 'paylater',
};

export const METHOD_LABEL: Readonly<Record<PaymentMethod, string>> = {
  upi: 'UPI',
  card: 'Card',
  netbanking: 'Net banking',
  wallet: 'Wallet',
  emi: 'EMI',
  paylater: 'Pay later',
  cash: 'Cash',
  pos: 'POS',
  other: 'Other',
};

/** Badge status (and label) per payment-line status. */
export const LINE_STATUS_LABEL: Readonly<Record<PaymentLineStatus, string>> = {
  captured: 'Paid',
  refunded: 'Refunded',
  failed: 'Failed',
};

/** "−₹500 · cash at desk" — what a refunded row says under its badge. */
export function refundCopy(refunds: readonly PaymentRefund[]): {
  readonly amount: number;
  readonly how: string;
} | null {
  const done = refunds.filter((r) => r.status !== 'failed' && r.status !== 'superseded');
  if (done.length === 0) return null;
  const amount = done.reduce((sum, r) => sum + r.amountRupees, 0);
  const methods = [...new Set(done.map((r) => r.method))];
  const how =
    methods.length === 1 && methods[0] === 'cash'
      ? 'at desk'
      : `to ${methods.map((m) => m.toUpperCase()).join(', ')}`;
  return { amount, how };
}

/* ------------------------------------------------------------------ refunds */

/** Bookings that are over: only these may be refunded from Payments (BE-09, UAT-10). */
const CLOSED_BOOKINGS: ReadonlySet<BookingStatus> = new Set(['cancelled', 'completed', 'no_show']);

/** Refund states that hold the line's one live refund: no second one may be asked for (UAT-41). */
const REFUND_IN_FLIGHT: ReadonlySet<RefundStatus> = new Set(['requested', 'processing']);

/**
 * The line's latest refund: what the row carries (backend B3), or — on an
 * older backend — the newest refund from its detail, `undefined` until loaded.
 */
export function lineRefundOf(
  line: PaymentLine,
  fetched: readonly PaymentRefund[] | undefined,
): LineRefund | null | undefined {
  if (line.latestRefund !== undefined) return line.latestRefund;
  if (fetched === undefined) return undefined;
  const live = fetched.filter((r) => r.status !== 'superseded');
  const latest = live[live.length - 1];
  return latest
    ? {
        id: latest.id,
        status: latest.status,
        amountRupees: latest.amountRupees,
        failureReason: latest.failureReason,
      }
    : null;
}

/** What the Refund action may do for one line. */
export type RefundAvailability =
  /** Not refundable from here at all (failed, a visit line, no booking). */
  | { readonly kind: 'none' }
  /** Already refunded in full. */
  | { readonly kind: 'refunded' }
  /** A refund is with the gateway: wait for it, do not ask twice. */
  | { readonly kind: 'processing' }
  /** The booking is still live: cancelling it refunds it (BE-09). */
  | { readonly kind: 'live'; readonly status: BookingStatus }
  /** May be refunded; `retry` after a failed refund. */
  | { readonly kind: 'available'; readonly retry: boolean };

/**
 * Whether a line may be refunded. A refund covers the whole booking, so it is
 * offered on paid lines of bookings that are over (cancelled, completed,
 * no-show); a live booking is cancelled instead, which refunds it. When the
 * booking's status is unknown the server decides (409 REFUND_REQUIRES_CANCEL).
 */
export function refundAvailability(
  line: PaymentLine,
  bookingStatus: BookingStatus | null,
  refund: LineRefund | null | undefined,
): RefundAvailability {
  if (line.status === 'refunded' || refund?.status === 'processed') return { kind: 'refunded' };
  if (line.status !== 'captured' || !line.appointmentId) return { kind: 'none' };
  if (refund && REFUND_IN_FLIGHT.has(refund.status)) return { kind: 'processing' };
  if (bookingStatus !== null && !CLOSED_BOOKINGS.has(bookingStatus)) {
    return { kind: 'live', status: bookingStatus };
  }
  return { kind: 'available', retry: refund?.status === 'failed' };
}

/** Badge status and label per refund state. */
export const REFUND_STATUS_BADGE: Readonly<
  Record<RefundStatus, { readonly status: string; readonly label: string }>
> = {
  // Both are "with the gateway" to the desk (B3: processing may also mean
  // the outcome is being reconciled).
  requested: { status: 'Pending', label: 'Refund pending' },
  processing: { status: 'Pending', label: 'Refund pending' },
  processed: { status: 'Refunded', label: 'Refunded' },
  failed: { status: 'Failed', label: 'Refund failed' },
  superseded: { status: 'Inactive', label: 'Replaced' },
};

/** What refunding a booking hands back: every captured line of its order. */
export function orderRefundTotal(lines: readonly PaymentLine[]): number {
  return lines.filter((l) => l.status === 'captured').reduce((s, l) => s + l.amountRupees, 0);
}

/** Backend codes a refund attempt can end with (D-28, BE-09). */
const CASH_SESSION_REQUIRED = 'CASH_SESSION_REQUIRED';
const REFUND_REQUIRES_CANCEL = 'REFUND_REQUIRES_CANCEL';

const REFUND_FAILED = 'The refund failed. Please try again.';

/**
 * What the desk is told when a refund is refused, in its own terms: open a
 * drawer (only if the role can), or cancel the live booking instead.
 */
export function refundFailureCopy(error: unknown, canOpenDrawer: boolean): string {
  if (!isFailure(error)) return REFUND_FAILED;
  if (error.code === CASH_SESSION_REQUIRED) {
    return canOpenDrawer
      ? 'Open your cash drawer before refunding cash. Other payment methods do not need it.'
      : 'Cash is handed back from an open cash drawer, and your role cannot open one. Ask a colleague who can.';
  }
  if (error.code === REFUND_REQUIRES_CANCEL) {
    return 'This booking is still live. Cancel it from Appointments — cancelling refunds it in full.';
  }
  return error.message;
}

/** Backend code for a write against a row that changed since it was read. */
const CONFLICT_VERSION = 'CONFLICT_VERSION';

/** What a refused drawer close or reconcile says, in the desk's terms (B2: If-Match, owner rule). */
export function cashWriteFailureCopy(error: unknown, fallback: string): string {
  if (!isFailure(error)) return fallback;
  if (error.code === CONFLICT_VERSION) {
    return 'This drawer changed since you opened it (a payment or another close). Close this window, refresh and try again.';
  }
  return error.message;
}

/** `08 Oct 2026 · 10:42 am` in the device's clock, or `—`. */
export function dateTimeCopy(iso: string | null): string {
  if (!iso) return '—';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '—';
  return `${fmtDate(toLocalISO(at))} · ${at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/** The day's figures for the KPI strip, from captured lines only. */
export interface PaymentTotals {
  readonly deskTotal: number;
  readonly deskCount: number;
  readonly deskCash: number;
  readonly onlineTotal: number;
}

export function totalsOf(lines: readonly PaymentLine[]): PaymentTotals {
  const desk = lines.filter((l) => l.channel === 'desk');
  const sum = (ls: readonly PaymentLine[]): number => ls.reduce((s, l) => s + l.amountRupees, 0);
  return {
    deskTotal: sum(desk),
    deskCount: desk.length,
    deskCash: sum(desk.filter((l) => l.method === 'cash')),
    onlineTotal: sum(lines.filter((l) => l.channel === 'online')),
  };
}

/** "10:42 am" for the Updated stamp; empty before the first load. */
export function updatedCopy(at: number): string {
  if (!at) return '—';
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/* ------------------------------------------------------------- cash drawer */

const PAISE_PER_RUPEE = 100;

/**
 * A rupee amount typed by staff ("500", "500.5", "1,250.75") as integer paise,
 * or `null` when it is not a plain amount with at most two decimals.
 */
export function rupeesToPaise(text: string): number | null {
  return parseHundredths(text);
}

/** Integer paise as rupees for display. */
export function paiseToRupees(paise: number): number {
  return paise / PAISE_PER_RUPEE;
}

/** How a counted drawer compares with what the server expected. */
export type DrawerBalance = 'balanced' | 'short' | 'over';

export function drawerBalance(variancePaise: number): DrawerBalance {
  if (variancePaise === 0) return 'balanced';
  return variancePaise < 0 ? 'short' : 'over';
}

/**
 * A summary row's variance over its counted drawers only — counted cash
 * against what those drawers should have held (B2 `counted_expected_paise`),
 * so an open drawer's float and takings never read as "short" (F25).
 */
export function summaryVariance(row: CashSummaryRow): number | null {
  if (row.countedCashPaise === null) return null;
  if (row.countedExpectedPaise !== null) return row.countedCashPaise - row.countedExpectedPaise;
  return row.variancePaise;
}

/** "9:14 am" in the device's clock, for when a drawer opened or closed. */
export function clockCopy(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
