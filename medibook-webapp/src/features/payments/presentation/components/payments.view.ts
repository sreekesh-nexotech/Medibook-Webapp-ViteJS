/**
 * Presentation lookups and pure helpers for the Payments screen (H9): the
 * look-back date windows, method / status vocabulary, and the day's totals.
 */
import { addDaysISO, formatInstant, parseHundredths, todayISO } from '@/shared/lib/format';

import type {
  PaymentLine,
  PaymentLineStatus,
  PaymentMethod,
  PaymentRefund,
} from '@/features/payments/domain/entities/payments.entities';

/** Payments look back: a window always ends today. */
export type PaymentWindow = 'Today' | 'This Week' | 'This Month';

export const PAYMENT_WINDOWS: readonly PaymentWindow[] = ['Today', 'This Week', 'This Month'];

const WEEK_DAYS = 7;
const FIRST_OF_MONTH = '01';

export interface DateRange {
  readonly dateFrom: string;
  readonly dateTo: string;
}

export function rangeForWindow(window: PaymentWindow): DateRange {
  const today = todayISO();
  if (window === 'This Week')
    return { dateFrom: addDaysISO(today, -(WEEK_DAYS - 1)), dateTo: today };
  if (window === 'This Month')
    return { dateFrom: `${today.slice(0, 8)}${FIRST_OF_MONTH}`, dateTo: today };
  return { dateFrom: today, dateTo: today };
}

/** The mode filter's options and the method each one asks the server for. */
export const MODE_FILTER: Readonly<Record<string, PaymentMethod>> = {
  Cash: 'cash',
  UPI: 'upi',
  Card: 'card',
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
  const done = refunds.filter((r) => r.status !== 'failed');
  if (done.length === 0) return null;
  const amount = done.reduce((sum, r) => sum + r.amountRupees, 0);
  const methods = [...new Set(done.map((r) => r.method))];
  const how =
    methods.length === 1 && methods[0] === 'cash'
      ? 'at desk'
      : `to ${methods.map((m) => m.toUpperCase()).join(', ')}`;
  return { amount, how };
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
  // Added up in integer paise, so the totals are exact (DATA-09).
  const sum = (ls: readonly PaymentLine[]): number =>
    ls.reduce((s, l) => s + Math.round(l.amountRupees * PAISE_PER_RUPEE), 0) / PAISE_PER_RUPEE;
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
  return formatInstant(at, { hour: 'numeric', minute: '2-digit' });
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

/** "9:14 am" on the hospital's clock, for when a drawer opened or closed. */
export function clockCopy(iso: string | null): string {
  if (!iso) return '—';
  return formatInstant(iso, { hour: 'numeric', minute: '2-digit' });
}
