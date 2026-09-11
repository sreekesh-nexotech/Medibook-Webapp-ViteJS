import { create } from 'zustand';

import { useHospitalsStore } from '@/features/ops-hospitals/application/store/hospitals.store';
import type { OpsHospital } from '@/features/ops-hospitals/application/store/hospitals.types';
import {
  longDateFromIso,
  opsStampNow,
  opsTodayIso,
} from '@/features/ops-hospitals/application/store/opsDates';
import { useLogsStore } from '@/features/ops-logs/application/store/logs.store';

import { nextTxnNo } from './billing.derive';
import { OPS_INVOICES, OPS_PAYMENTS } from './billing.fixtures';
import type { Invoice, Payment, PaymentMethod, ReminderChannel } from './billing.types';

/**
 * Ops subscription-billing store (design `OpsDB.invoices` / `OpsDB.payments`),
 * extended with the collection actions audit SA-03 found missing: reminders,
 * mark-as-paid, payment retry and the grace window.
 *
 * Every action records only what actually happened:
 *  - a reminder is written to history as **Queued**, never "sent";
 *  - mark-as-paid takes a real mode, reference and date, writes the payment
 *    row it implies and recomputes the invoice status from it;
 *  - a retry moves the payment to its next attempt and leaves it **Pending** —
 *    it does not pretend the bank has approved anything.
 */

/** Compliance-log module name for every billing mutation. */
const BILLING_LOG_MODULE = 'Billing';

/** Demo operations actor every billing mutation is attributed to. */
const OPS_ACTOR = 'riya.sharma@medibook.in';

/** What ops fills in when recording a payment received outside the gateway. */
export interface MarkPaidInput {
  readonly mode: PaymentMethod;
  /** UTR / cheque number / gateway reference. */
  readonly reference: string;
  /** Local-calendar ISO date the money arrived. */
  readonly dateIso: string;
}

interface BillingState {
  invoices: readonly Invoice[];
  payments: readonly Payment[];
  /** When the snapshot the screens render was last taken (Refresh feedback). */
  syncedAt: string;
}

interface BillingActions {
  /**
   * Re-read the billing snapshot and re-stamp the sync clock; resolves when
   * the new snapshot is in place so the screen's loading state lasts exactly
   * as long as the work (audit 3.1.1). Becomes the query invalidation when
   * the API lands.
   */
  resync: () => Promise<void>;
  /** Record a payment reminder against an unpaid invoice. */
  sendReminder: (invoiceId: number, channel: ReminderChannel, to: string) => void;
  /** Record a payment received off-gateway; recomputes the invoice status. */
  markPaid: (invoiceId: number, input: MarkPaidInput) => void;
  /** Retry a failed payment: next attempt, left Pending until it settles. */
  retryPayment: (paymentId: number) => void;
  /** Per-invoice grace override; `undefined` falls back to hospital/platform. */
  setInvoiceGrace: (invoiceId: number, days: number | undefined) => void;
}

export const useBillingStore = create<BillingState & BillingActions>()((set, get) => {
  const log = (
    hid: number,
    action: string,
    sev: 'Info' | 'Warning' | 'Critical' = 'Info',
  ): void => {
    useLogsStore.getState().addLog({ hid, action, module: BILLING_LOG_MODULE, sev });
  };

  return {
    invoices: OPS_INVOICES,
    payments: OPS_PAYMENTS,
    syncedAt: opsStampNow(),

    resync: async () => {
      set((s) => ({
        invoices: [...s.invoices],
        payments: [...s.payments],
        syncedAt: opsStampNow(),
      }));
    },

    sendReminder: (invoiceId, channel, to) => {
      const inv = get().invoices.find((x) => x.id === invoiceId);
      if (!inv || inv.status === 'Completed') return;
      set((s) => ({
        invoices: s.invoices.map((x) =>
          x.id === invoiceId
            ? {
                ...x,
                reminders: [
                  {
                    id: Math.max(0, ...x.reminders.map((r) => r.id)) + 1,
                    at: opsStampNow(),
                    channel,
                    to,
                    status: 'Queued',
                    by: OPS_ACTOR,
                  },
                  ...x.reminders,
                ],
              }
            : x,
        ),
      }));
      log(inv.hid, `Payment reminder queued (${channel}) — ${inv.no} to ${to}`);
    },

    markPaid: (invoiceId, input) => {
      const inv = get().invoices.find((x) => x.id === invoiceId);
      if (!inv || inv.status === 'Completed') return;
      const paidDisplay = longDateFromIso(input.dateIso);
      const txn = nextTxnNo(get().payments);
      const payment: Payment = {
        id: Math.max(0, ...get().payments.map((p) => p.id)) + 1,
        txn,
        inv: inv.no,
        hid: inv.hid,
        hospital: inv.hospital,
        method: input.mode,
        amount: inv.amount,
        date: paidDisplay,
        status: 'Success',
        attempts: 1,
        lastAttemptAt: opsStampNow(),
      };
      set((s) => ({
        invoices: s.invoices.map((x) =>
          x.id === invoiceId
            ? {
                ...x,
                status: 'Completed',
                paidOn: input.dateIso,
                paidMode: input.mode,
                paidRef: input.reference,
              }
            : x,
        ),
        payments: [payment, ...s.payments],
      }));
      log(
        inv.hid,
        `Invoice marked paid — ${inv.no} via ${input.mode} (${input.reference}) on ${paidDisplay}`,
      );
    },

    retryPayment: (paymentId) => {
      const pay = get().payments.find((p) => p.id === paymentId);
      if (!pay || pay.status === 'Success') return;
      const attempt = pay.attempts + 1;
      set((s) => ({
        payments: s.payments.map((p) =>
          p.id === paymentId
            ? { ...p, status: 'Pending', attempts: attempt, lastAttemptAt: opsStampNow() }
            : p,
        ),
        // The invoice is no longer "failed" — a fresh attempt is in flight.
        invoices: s.invoices.map((x) =>
          x.no === pay.inv && x.status === 'Payment failed' ? { ...x, status: 'Pending' } : x,
        ),
      }));
      log(pay.hid, `Payment retried (attempt ${attempt}) — ${pay.txn} on ${pay.inv}`, 'Warning');
    },

    setInvoiceGrace: (invoiceId, days) => {
      const inv = get().invoices.find((x) => x.id === invoiceId);
      if (!inv) return;
      set((s) => ({
        invoices: s.invoices.map((x) => (x.id === invoiceId ? { ...x, graceDays: days } : x)),
      }));
      log(
        inv.hid,
        days === undefined
          ? `Invoice grace window reset to the default — ${inv.no}`
          : `Invoice grace window set to ${days} day${days === 1 ? '' : 's'} — ${inv.no}`,
      );
    },
  };
});

/** The hospital an invoice or payment belongs to, or `null` when unknown. */
export function billingHospital(hid: number): OpsHospital | null {
  return useHospitalsStore.getState().hospitals.find((h) => h.id === hid) ?? null;
}

/** Today, as the billing screens count grace windows. */
export function billingTodayIso(): string {
  return opsTodayIso();
}
